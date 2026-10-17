// Manual smoke test against the real CreateOS Sandbox API (uses ONE sandbox creation; Free plan: 1 concurrent, 10/day).
//   cd apps/server && node --env-file=../../.env --env-file-if-exists=.env --import tsx src/sandbox/smoke.ts
// Steps: create → node -v → upload + run a file → guarantee verifier flow (npm install + vitest) → preview URL of
// python3 -m http.server (process API) → exec deadline → snapshot checkpoint → pause + fork → auto-resume →
// destroy (always, in finally) → confirm nothing is left running. Egress, guest timeouts and pause/resume were
// checked by earlier runs of this script (see the sandbox agent report).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInBox, sanitizeAcceptance, sanitizeFiles } from "../verifier/sandbox.js";
import { createosPort, SandboxError, type SandboxPort } from "./client.js";
import { restoreScript, snapshotScript } from "./pool.js";
import { BASE_EGRESS } from "./rules.js";

const log = (step: string, v: unknown) => console.log(`[smoke] ${step}:`, typeof v === "string" ? v : JSON.stringify(v));

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const r = await fn();
    log(name, r ?? "ok");
    return r;
  } catch (e) {
    log(`${name} FAILED`, e instanceof SandboxError ? `${e.code}: ${e.message}` : String(e));
    return undefined;
  }
}

async function fetchStatus(url: string): Promise<string> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    return `${r.status} ${(await r.text()).slice(0, 80).replace(/\s+/g, " ")}`;
  } catch (e) {
    return `fetch error: ${(e as Error).message}`;
  }
}

async function main(port: SandboxPort) {
  const before = await port.list();
  log("existing boxes", before);
  if (before.some((b) => b.status !== "destroying")) throw new Error("A sandbox is already alive (Free plan allows 1): destroy it first.");

  const t0 = Date.now();
  const box = await port.create({ egress: BASE_EGRESS, ingress: false, autoPauseSeconds: 300, name: `smoke-${Date.now().toString(36)}` });
  log("created", { ...box, ms: Date.now() - t0 });
  const forks: string[] = [];
  try {
    const run = (cmd: string, args: string[], timeoutMs = 60_000, cwd = "/") => port.run(box.id, cmd, args, { timeoutMs, cwd });
    await step("node -v", () => run("node", ["-v"]));
    await step("upload", () => port.upload(box.id, "/workspace/hello.js", 'console.log("hello from", process.version, process.cwd())\n'));
    await step("run uploaded", () => run("node", ["hello.js"], 30_000, "/workspace"));

    // Guarantee verifier (verifier/sandbox.ts) on the React example delivery, reusing this box.
    const ex = fileURLToPath(new URL("../../../../agents/frontend-react/verifier/example/", import.meta.url));
    const component = readFileSync(`${ex}LoginForm.tsx`, "utf8");
    const test = readFileSync(`${ex}LoginForm.test.tsx`, "utf8");
    await step("verifier runInBox", async () => {
      const v0 = Date.now();
      const r = await runInBox(port, box.id, sanitizeFiles({ "LoginForm.tsx": component }), sanitizeAcceptance({ "LoginForm.test.tsx": test }));
      return { ms: Date.now() - v0, ...r.report, log: r.report.log?.slice(-600), preview: r.previewHtml?.slice(0, 80) };
    });

    // Live URL: a server started through the process API (an exec with `&` never returns), ingress turned on afterwards.
    await step("spawn http.server", () => port.spawn(box.id, "python3", ["-m", "http.server", "8080", "--bind", "0.0.0.0"], { cwd: "/workspace", logPath: "/tmp/http.log" }));
    const url = await step("preview url", () => port.preview(box.id, 8080, { waitMs: 30_000 }));
    if (url) {
      log("GET https", await fetchStatus(url));
      log("GET http", await fetchStatus(url.replace(/^https:/, "http:")));
    }

    // An exec that leaves a child behind must come back at the deadline, not hang until the box auto-pauses.
    await step("exec with a leftover child (5 s deadline)", async () => {
      const h0 = Date.now();
      const r = await run("bash", ["-lc", "sleep 600 & echo started"], 5_000);
      return { ...r, wallMs: Date.now() - h0 };
    });

    // Checkpoint as the pool does it on the Free plan: snapshot /workspace, break it, restore it.
    const cp = "smoke-checkpoint";
    await step("snapshot", () => run("bash", ["-lc", snapshotScript(cp)]));
    await step("break workspace", () => run("bash", ["-lc", "echo broken > /workspace/hello.js && touch /workspace/extra"]));
    await step("restore snapshot", () => run("bash", ["-lc", restoreScript(cp)]));
    await step("after restore", () => run("bash", ["-lc", "cat /workspace/hello.js; ls /workspace"]));
    await step("pause", async () => {
      const p0 = Date.now();
      await port.pause(box.id);
      return `paused in ${Date.now() - p0} ms`;
    });
    const fork = await step("fork (start_paused)", () => port.fork(box.id, { startPaused: true }));
    if (fork) forks.push(fork.id);
    await step("run on paused box (auto-resume)", () => run("node", ["hello.js"], 30_000, "/workspace"));
  } finally {
    for (const id of [...forks, box.id]) await step(`destroy ${id}`, () => port.destroy(id));
    const after = await port.list().catch((e) => String(e));
    log("left after destroy", after);
  }
}

// Global guard: whatever hangs, the finally above has run or the process exits (keep-alive sockets must not hold it).
setTimeout(() => {
  console.error("[smoke] global timeout");
  process.exit(2);
}, 12 * 60_000).unref();
try {
  await main(createosPort());
} finally {
  process.exit(0);
}
