import { posix } from "node:path";
import { env } from "../env.js";
import { badRequest } from "../lib/http.js";
import type { SandboxPort } from "../sandbox/client.js";
import { verifierSandboxPort } from "../sandbox/deps.js";
import { createPool, sandboxHttpError, type SandboxStore } from "../sandbox/pool.js";
import { AUTO_PAUSE_SECONDS, VERIFIER_EGRESS } from "../sandbox/rules.js";
import { CONTAINER_WORK, evaluateReport, PREVIEW_TEST_FILE, type Files, type RunResult } from "./report.js";

// Guarantee verifier (INSTRUCTIONS.md 5.7, PLANO.md 6.5): runs the delivery against the agreed acceptance suite in an
// ephemeral CreateOS sandbox (devbox:1, egress only to the npm registry, never the session's box), destroyed in `finally`.
// The box installs the runner (vitest + Testing Library, same as agents/frontend-react/verifier) under /work, the
// layout report.ts expects, then runs the tests. One run at a time (queue). It also captures a static HTML preview.
// Everything that comes back from the box (report and preview) is UNTRUSTED: size-capped and parsed defensively.
// Known gap versus the old Docker runner: the delivery runs in the same box as the runner, so it could forge the report.

export type { Files, RunResult, TestReport } from "./report.js";

const ALLOWED_EXT = /\.(tsx?|jsx?|css|json|md)$/;
const RESERVED = /^(acceptance\.|__preview__)/;
const MAX_TOTAL_BYTES = 300_000;
const MAX_FILES = 40;
const MAX_OUTPUT = 200_000;
/** npm install + vitest in one command (dependencies are installed per run on devbox:1). */
const TIMEOUT_MS = 300_000;
/** Caps on the files that come back from the box. */
const MAX_JSON_BYTES = 2_000_000;
const MAX_PREVIEW_BYTES = 400_000;

const WORK = CONTAINER_WORK;

/** Runner project (agents/frontend-react/verifier): package.json, vitest config and setup. */
export const RUNNER_FILES: Files = {
  "package.json": JSON.stringify(
    {
      name: "solvers-react-test",
      private: true,
      type: "module",
      dependencies: { react: "^19.3.0", "react-dom": "^19.3.0" },
      devDependencies: {
        "@testing-library/dom": "^10.4.2",
        "@testing-library/jest-dom": "^7.0.1",
        "@testing-library/react": "^16.3.3",
        "@testing-library/user-event": "^14.6.7",
        jsdom: "^30.1.1",
        vitest: "^5.0.2",
      },
    },
    null,
    2,
  ),
  "setup.ts": `import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
`,
  "vitest.config.ts": `import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: "/tmp/vite-cache",
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    testTimeout: 10_000,
    outputFile: { json: "./report/vitest.json" },
    pool: "forks",
    maxWorkers: 1,
  },
});
`,
};

function normalizeName(name: string): string {
  const norm = posix.normalize(name.replace(/\\/g, "/")).replace(/^\/+/, "");
  if (norm.startsWith("..") || norm.includes("/../") || !ALLOWED_EXT.test(norm)) throw badRequest(`File not allowed: ${name}`);
  return norm;
}

/** Validates names (no ../, no absolute path, no reserved names) and the delivery size. */
export function sanitizeFiles(files: Files): Files {
  const entries = Object.entries(files);
  if (entries.length === 0) throw badRequest("Delivery has no files");
  if (entries.length > MAX_FILES) throw badRequest(`At most ${MAX_FILES} files per delivery`);
  let total = 0;
  const out: Files = {};
  for (const [name, content] of entries) {
    const norm = normalizeName(name);
    if (RESERVED.test(posix.basename(norm))) throw badRequest(`Name reserved for the acceptance test suite: ${name}`);
    total += Buffer.byteLength(content);
    out[norm] = content;
  }
  if (total > MAX_TOTAL_BYTES) throw badRequest("Delivery too large (max. 300 KB)");
  return out;
}

/** Acceptance suite: test files only, written as acceptance.<name> at the root of src. */
export function sanitizeAcceptance(files: Files): Files {
  const out: Files = {};
  for (const [name, content] of Object.entries(files)) {
    const norm = normalizeName(name);
    if (!/\.test\.(tsx?|jsx?)$/.test(norm) || norm.includes("/")) throw badRequest(`Invalid acceptance test: ${name} (use Name.test.tsx)`);
    out[`acceptance.${norm}`] = content;
  }
  if (Object.keys(out).length === 0) throw badRequest("Acceptance test suite is empty");
  return out;
}

/** Main component of the delivery (first .tsx/.jsx that is not a test and exports something). */
export function entryComponent(files: Files): string | null {
  const entry = Object.entries(files).find(
    ([n, c]) => /\.(tsx|jsx)$/.test(n) && !/\.test\./.test(n) && /export\s+(default\s+)?(function|const)\s+[A-Z]/.test(c),
  );
  return entry ? entry[0] : null;
}

/**
 * Helper test that renders the component and writes the static HTML for the preview. It never fails:
 * the server requires exit code 0 from vitest, and the preview is optional (a component that needs
 * other props, or that fails to import, simply gets no preview).
 */
function previewTest(entry: string): string {
  const mod = `./${entry.replace(/\.(tsx|jsx)$/, "")}`;
  return `import { render } from "@testing-library/react";
import { writeFileSync } from "node:fs";
import { it } from "vitest";
it("__preview__", async () => {
  try {
    const all = (await import(${JSON.stringify(mod)})) as Record<string, unknown>;
    const C = (all.default ?? Object.values(all).find((v) => typeof v === "function" && /^[A-Z]/.test((v as { name: string }).name))) as never;
    if (!C) return;
    const { container } = render(<C {...({ onSubmit: () => {} } as object)} />);
    writeFileSync("/work/report/preview.html", container.innerHTML);
  } catch {
    // no preview
  }
});
`;
}

let queue: Promise<unknown> = Promise.resolve();

/** Queues work so one verification runs at a time (the Free plan allows one sandbox at a time). */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

/** Removes scripts, handlers and javascript: URLs from the captured HTML (the preview runs nothing). */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "")
    .slice(0, 200_000);
}

function simulate(files: Files, acceptance: Files | null): RunResult {
  const tests = Object.keys({ ...files, ...(acceptance ?? {}) }).filter((n) => /\.test\.(tsx?|jsx?)$/.test(n));
  const all = { ...files, ...(acceptance ?? {}) };
  const count = tests.reduce((acc, t) => acc + (all[t]!.match(/\b(it|test)\(/g)?.length ?? 0), 0);
  const accCount = acceptance ? Object.values(acceptance).reduce((a, c) => a + (c.match(/\b(it|test)\(/g)?.length ?? 0), 0) : 0;
  const passed = count > 0 && entryComponent(files) != null;
  return {
    report: {
      passed,
      mode: "simulated",
      numTests: count,
      numPassed: passed ? count : 0,
      numFailed: passed ? 0 : 1,
      acceptance: acceptance ? { numTests: accCount, numPassed: passed ? accCount : 0 } : null,
      failures: passed ? [] : [{ test: "structure", message: "The delivery needs a component and tests (*.test.tsx)." }],
      durationMs: 0,
    },
    previewHtml: null,
  };
}

/** Untrusted JSON from the box: size-capped, parsed without throwing. */
function parseReport(bytes: Uint8Array | null): { ok: true; value: unknown } | { ok: false; problem: string } {
  if (!bytes) return { ok: false, problem: "The test report was not written." };
  if (bytes.byteLength > MAX_JSON_BYTES) return { ok: false, problem: "The test report is too large." };
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, problem: "The test report is not valid JSON." };
  }
}

/**
 * Installs the runner and runs the tests in an already created box (egress to the npm registry), then reads the
 * report. Exported for the smoke script, which reuses its own box instead of spending another sandbox creation.
 */
export async function runInBox(port: SandboxPort, boxId: string, files: Files, acceptance: Files | null): Promise<RunResult> {
  const t0 = Date.now();
  const all: Files = { ...files, ...(acceptance ?? {}) };
  const entry = entryComponent(files);
  if (entry) all[PREVIEW_TEST_FILE] = previewTest(entry);
  const dirs = new Set([`${WORK}/report`, ...Object.keys(all).map((n) => posix.dirname(`${WORK}/src/${n}`))]);
  const mk = await port.run(boxId, "mkdir", ["-p", "--", ...dirs], { timeoutMs: 30_000 });
  if (mk.exitCode !== 0) throw new Error(`verifier: mkdir failed: ${mk.stderr.slice(-300)}`);
  for (const [name, content] of Object.entries(RUNNER_FILES)) await port.upload(boxId, `${WORK}/${name}`, content);
  for (const [name, content] of Object.entries(all)) await port.upload(boxId, `${WORK}/src/${name}`, content);
  const r = await port.run(
    boxId,
    "bash",
    ["-lc", `cd ${WORK} && npm install --no-audit --no-fund --ignore-scripts --loglevel=error && CI=true NODE_ENV=test npx --no-install vitest run --reporter=json --outputFile.json=${WORK}/report/vitest.json`],
    { timeoutMs: TIMEOUT_MS, cwd: WORK },
  );
  const out = `${r.stdout}\n${r.stderr}`.slice(-MAX_OUTPUT);
  const read = parseReport(await port.download(boxId, `${WORK}/report/vitest.json`).catch(() => null));
  const testReport = evaluateReport({
    json: read.ok ? read.value : null,
    jsonProblem: read.ok ? undefined : read.problem,
    exitCode: r.exitCode,
    timedOut: r.timedOut,
    out,
    acceptanceFiles: acceptance ? Object.keys(acceptance) : null,
    durationMs: Date.now() - t0,
  });
  let previewHtml: string | null = null;
  if (testReport.passed) {
    const p = await port.download(boxId, `${WORK}/report/preview.html`).catch(() => null);
    if (p && p.byteLength <= MAX_PREVIEW_BYTES) previewHtml = sanitizeHtml(new TextDecoder().decode(p));
  }
  return { report: testReport, previewHtml };
}

/** No rows for verifier boxes: they live only inside one call (`ephemeral` destroys them in finally). */
const noStore: SandboxStore = {
  active: async () => null,
  latestActive: async () => null,
  get: async () => null,
  list: async () => [],
  insert: async () => {
    throw new Error("verifier sandboxes are not recorded");
  },
  update: async () => undefined,
  idle: async () => [],
  logRun: async () => undefined,
};

/** `image` is kept for callers of the Docker era; the runner image is now fixed (devbox:1 + RUNNER_FILES). */
export async function runTests(rawFiles: Files, opts: { acceptance?: Files | null; image?: string } = {}): Promise<RunResult> {
  const files = sanitizeFiles(rawFiles);
  const acceptance = opts.acceptance ?? null;
  if (env.VERIFIER_MODE === "simulated") return simulate(files, acceptance);
  return enqueue(async () => {
    const pool = createPool({ port: verifierSandboxPort(), store: noStore });
    try {
      return await pool.ephemeral({ egress: VERIFIER_EGRESS, ingress: false, autoPauseSeconds: AUTO_PAUSE_SECONDS }, (boxId) => runInBox(pool.port, boxId, files, acceptance));
    } catch (e) {
      throw sandboxHttpError(e) ?? e;
    }
  });
}
