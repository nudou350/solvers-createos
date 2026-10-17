import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { HttpError } from "../src/lib/http.js";
import { runSandboxToolWith } from "../src/mcp/sandbox-tools.js";
import { FakeSandboxPort, MemorySandboxStore } from "../src/sandbox/fake.js";
import { createPool, sandboxHttpError } from "../src/sandbox/pool.js";
import { BASE_EGRESS, MAX_STREAM_BYTES } from "../src/sandbox/rules.js";
import { verifyChecks } from "../src/sandbox/verify.js";

// Pool, verify and MCP sandbox tools on the in-memory fake (no CreateOS, no database).

const U = "11111111-1111-4111-8111-111111111111";
const ctx = { userId: U, sessionId: "s1", agentId: "createos", trial: null };

function setup(opts: ConstructorParameters<typeof FakeSandboxPort>[0] = {}, clock = { t: Date.parse("2026-10-17T12:00:00Z") }) {
  const port = new FakeSandboxPort(opts);
  const now = () => new Date(clock.t);
  const store = new MemorySandboxStore(now);
  return { port, store, pool: createPool({ port, store, now }), clock };
}

describe("session sandbox", () => {
  it("creates one box per (user, session) with ingress, egress allowlist and /workspace, then reuses it", async () => {
    const { port, store, pool } = setup();
    const a = await pool.session(U, "s1");
    const b = await pool.session(U, "s1");
    assert.equal(a.boxId, b.boxId);
    assert.equal(port.created, 1);
    const box = port.boxes.get(a.boxId)!;
    assert.equal(box.ingress, true);
    assert.deepEqual(box.egress, [...BASE_EGRESS]);
    assert.ok(port.calls.some((c) => c.op === "run" && c.cmd === "mkdir" && c.args?.includes("/workspace")));
    assert.equal((await store.active(U, "s1"))?.createosId, a.boxId);
  });

  it("a new session of the same user takes over the earlier box, reset, instead of creating one", async () => {
    const { port, store, pool } = setup();
    const a = await pool.session(U, "s1");
    const b = await pool.session(U, "s2");
    assert.equal(b.boxId, a.boxId);
    assert.equal(port.created, 1);
    assert.ok(port.calls.some((c) => c.op === "run" && c.cmd === "bash" && c.args?.some((x) => x.includes("find /workspace -mindepth 1 -delete"))));
    assert.equal((await store.active(U, "s2"))?.createosId, a.boxId);
    assert.equal(await store.active(U, "s1"), null);
    await pool.session("22222222-2222-4222-8222-222222222222", "s3");
    assert.equal(port.created, 2);
  });

  it("resumes a paused box and replaces a lost one", async () => {
    const { port, store, pool } = setup();
    const a = await pool.session(U, "s1");
    await port.pause(a.boxId);
    const b = await pool.session(U, "s1");
    assert.equal(b.boxId, a.boxId);
    assert.equal(port.boxes.get(a.boxId)!.status, "running");
    await port.destroy(a.boxId);
    const c = await pool.session(U, "s1");
    assert.notEqual(c.boxId, a.boxId);
    assert.equal((await store.get(a.row.id))?.status, "destroyed");
  });

  it("concurrent calls for the same session create a single box", async () => {
    const { port, pool } = setup();
    const [a, b] = await Promise.all([pool.session(U, "s1"), pool.session(U, "s1")]);
    assert.equal(a.boxId, b.boxId);
    assert.equal(port.created, 1);
  });

  it("at the plan cap: reclaims a box idle for 5+ minutes, else a clear 429", async () => {
    const { port, store, pool, clock } = setup({ maxConcurrent: 1 });
    const a = await pool.session(U, "s1");
    // Another user: the same user's new session would take over its own box instead of creating one.
    const V = "22222222-2222-4222-8222-222222222222";
    await assert.rejects(pool.session(V, "s2"), (e) => {
      const h = sandboxHttpError(e);
      return h instanceof HttpError && h.status === 429 && /busy/.test(h.message);
    });
    clock.t += 6 * 60_000;
    const b = await pool.session(V, "s2");
    assert.notEqual(b.boxId, a.boxId);
    assert.equal((await store.get(a.row.id))?.status, "destroyed");
  });

  it("destroyIdle removes boxes unused for 30 minutes", async () => {
    const { port, pool, clock } = setup();
    const a = await pool.session(U, "s1");
    clock.t += 29 * 60_000;
    assert.equal(await pool.destroyIdle(), 0);
    clock.t += 2 * 60_000;
    assert.equal(await pool.destroyIdle(), 1);
    assert.equal(port.boxes.get(a.boxId)!.status, "destroyed");
  });

  it("ephemeral boxes are destroyed even when the work throws", async () => {
    const { port, pool } = setup();
    let id = "";
    await assert.rejects(
      pool.ephemeral({ egress: ["registry.npmjs.org:443"] }, async (boxId) => {
        id = boxId;
        throw new Error("boom");
      }),
      /boom/,
    );
    assert.equal(port.boxes.get(id)!.status, "destroyed");
  });
});

describe("sandbox_run / sandbox_preview", () => {
  it("uploads files under /workspace, runs in /workspace and logs the run", async () => {
    const { port, store, pool } = setup();
    const out = (await runSandboxToolWith(pool, "sandbox_run", { command: "cat", args: ["/workspace/app/a.txt"], files: [{ path: "app/a.txt", content: "hi" }] }, ctx)) as Record<string, unknown>;
    assert.deepEqual(out, { stdout: "hi", stderr: "", exit_code: 0, exec_ms: 1, truncated: false });
    const run = port.calls.filter((c) => c.op === "run").at(-1)!;
    assert.equal(run.cmd, "cat");
    assert.equal(store.runs.length, 1);
    assert.equal(store.runs[0]!.kind, "run");
    assert.equal(store.runs[0]!.agentId, "createos");
    assert.equal([...store.rows.values()][0]!.runs, 1);
  });

  it("truncates long output and reports the exit code", async () => {
    const { port, pool } = setup();
    port.respond((cmd) => (cmd === "noisy" ? { stdout: "x".repeat(100_000), exitCode: 3 } : undefined));
    const out = (await runSandboxToolWith(pool, "sandbox_run", { command: "noisy" }, ctx)) as { stdout: string; exit_code: number; truncated: boolean };
    assert.equal(out.exit_code, 3);
    assert.equal(out.truncated, true);
    assert.ok(Buffer.byteLength(out.stdout) < MAX_STREAM_BYTES + 100);
  });

  it("refuses paths outside /workspace with a 400 before creating anything", async () => {
    const { port, pool } = setup();
    await assert.rejects(runSandboxToolWith(pool, "sandbox_run", { command: "ls", files: [{ path: "../etc/x", content: "" }] }, ctx), (e) => e instanceof HttpError && e.status === 400);
    assert.equal(port.created, 0);
  });

  it("caps the timeout lower during a free trial", async () => {
    const { port, pool } = setup();
    let seen = 0;
    port.respond((_c, _a, o) => {
      seen = o.timeoutMs;
      return {};
    });
    await runSandboxToolWith(pool, "sandbox_run", { command: "sleep", args: ["1"], timeout_ms: 300_000 }, { ...ctx, trial: {} as never });
    assert.equal(seen, 120_000);
  });

  it("background runs return a process id and log file", async () => {
    const { pool } = setup();
    const out = (await runSandboxToolWith(pool, "sandbox_run", { command: "node", args: ["server.js"], background: true }, ctx)) as Record<string, string>;
    assert.match(out.process_id!, /^proc-/);
    assert.match(out.log_path!, /^\/tmp\/solvers-.*\.log$/);
  });

  it("preview returns the public URL and logs kind=preview", async () => {
    const { store, pool } = setup();
    const out = (await runSandboxToolWith(pool, "sandbox_preview", { port: 3000 }, ctx)) as { url: string };
    assert.match(out.url, /-3000\./);
    assert.equal(store.runs.at(-1)!.kind, "preview");
  });
});

describe("sandbox_checkpoint / sandbox_restore", () => {
  it("fork: the checkpoint is a paused fork; restore forks it again and stays reusable", async () => {
    const { port, store, pool } = setup();
    await runSandboxToolWith(pool, "sandbox_run", { command: "true", files: [{ path: "a.txt", content: "v1" }] }, ctx);
    const cp = (await runSandboxToolWith(pool, "sandbox_checkpoint", {}, ctx)) as { checkpoint_id: string; method: string };
    assert.equal(cp.method, "fork");
    const cpRow = (await store.get(cp.checkpoint_id))!;
    assert.equal(cpRow.status, "checkpoint");
    assert.equal(port.boxes.get(cpRow.createosId!)!.status, "paused");
    const first = (await store.active(U, "s1"))!;
    assert.equal(port.boxes.get(first.createosId!)!.status, "running");

    await runSandboxToolWith(pool, "sandbox_run", { command: "true", files: [{ path: "a.txt", content: "broken" }] }, ctx);
    const r = (await runSandboxToolWith(pool, "sandbox_restore", { checkpoint_id: cp.checkpoint_id }, ctx)) as { method: string; restored: boolean };
    assert.equal(r.method, "fork");
    const now = (await store.active(U, "s1"))!;
    assert.notEqual(now.createosId, first.createosId);
    assert.equal(port.boxes.get(first.createosId!)!.status, "destroyed");
    assert.equal(port.boxes.get(now.createosId!)!.files.get("/workspace/a.txt"), "v1");
    assert.equal((await store.get(cp.checkpoint_id))!.status, "checkpoint");
  });

  it("only the newest fork checkpoint is kept", async () => {
    const { port, store, pool } = setup();
    const a = (await runSandboxToolWith(pool, "sandbox_checkpoint", {}, ctx)) as { checkpoint_id: string };
    const b = (await runSandboxToolWith(pool, "sandbox_checkpoint", {}, ctx)) as { checkpoint_id: string };
    assert.equal((await store.get(a.checkpoint_id))!.status, "destroyed");
    assert.equal((await store.get(b.checkpoint_id))!.status, "checkpoint");
    assert.equal(port.live().length, 2);
  });

  it("without fork (Free plan): falls back to a /workspace snapshot, resumes the box, and restores from it", async () => {
    const { port, store, pool } = setup({ maxConcurrent: 1, forkSupported: false });
    const scripts: string[] = [];
    port.respond((cmd, args) => {
      if (cmd === "bash" && args[0] === "-lc" && /tar /.test(args[1]!)) scripts.push(args[1]!);
      return undefined;
    });
    const cp = (await runSandboxToolWith(pool, "sandbox_checkpoint", {}, ctx)) as { checkpoint_id: string; method: string };
    assert.equal(cp.method, "snapshot");
    const box = (await store.active(U, "s1"))!.createosId!;
    assert.equal(port.boxes.get(box)!.status, "running");
    assert.match(scripts[0]!, new RegExp(`tar -czf /var/tmp/solvers-checkpoints/${cp.checkpoint_id}\\.tgz -C /workspace \\.`));
    const r = (await runSandboxToolWith(pool, "sandbox_restore", { checkpoint_id: cp.checkpoint_id }, ctx)) as { method: string };
    assert.equal(r.method, "snapshot");
    assert.match(scripts[1]!, /find \/workspace -mindepth 1 -delete && tar -xzf/);
  });

  it("restore refuses another session's or an unknown checkpoint", async () => {
    const { pool } = setup();
    const cp = (await runSandboxToolWith(pool, "sandbox_checkpoint", {}, ctx)) as { checkpoint_id: string };
    await assert.rejects(runSandboxToolWith(pool, "sandbox_restore", { checkpoint_id: cp.checkpoint_id }, { ...ctx, sessionId: "other" }), (e) => e instanceof HttpError && e.status === 404);
    await assert.rejects(runSandboxToolWith(pool, "sandbox_restore", { checkpoint_id: "nope" }, ctx), (e) => e instanceof HttpError && e.status === 404);
  });
});

describe("runStepVerify (verifyChecks)", () => {
  const input = { userId: U, sessionId: "s1", agentId: "createos" };

  it("creates the session box on the first check, passes with proofs and logs kind=verify", async () => {
    const { port, store, pool } = setup();
    const r = await verifyChecks(pool, { ...input, checks: [{ label: "Node", command: "node", args: ["-v"] }, { label: "Py", command: "python3", args: ["--version"], expectExit: 0 }] });
    assert.equal(r.passed, true);
    assert.deepEqual(r.results.map((x) => [x.label, x.passed, x.exitCode, x.stdout]), [
      ["Node", true, 0, "v24.0.0\n"],
      ["Py", true, 0, "Python 3.13.0\n"],
    ]);
    assert.equal(port.created, 1);
    assert.deepEqual(store.runs.map((x) => x.kind), ["verify", "verify"]);
  });

  it("stops at the first failed check and returns its output; expectExit is honored", async () => {
    const { port, pool } = setup();
    port.respond((cmd) => (cmd === "npm" ? { stderr: "ERR! missing script: test", exitCode: 1 } : undefined));
    const r = await verifyChecks(pool, {
      ...input,
      checks: [
        { label: "Expected failure", command: "false", expectExit: 1 },
        { label: "Tests", command: "npm", args: ["test"] },
        { label: "Never runs", command: "true" },
      ],
    });
    assert.equal(r.passed, false);
    assert.equal(r.results.length, 2);
    assert.equal(r.results[0]!.passed, true);
    assert.equal(r.results[1]!.passed, false);
    assert.match(r.results[1]!.stderr, /missing script/);
  });

  it("no checks: passes without touching the sandbox", async () => {
    const { port, pool } = setup();
    assert.deepEqual(await verifyChecks(pool, { ...input, checks: [] }), { passed: true, results: [] });
    assert.equal(port.created, 0);
  });

  it("capacity errors surface as a 429 for the engine", async () => {
    const { port, pool } = setup({ maxConcurrent: 0 });
    await assert.rejects(verifyChecks(pool, { ...input, checks: [{ label: "x", command: "true" }] }), (e) => e instanceof HttpError && e.status === 429);
    assert.equal(port.created, 0);
  });
});
