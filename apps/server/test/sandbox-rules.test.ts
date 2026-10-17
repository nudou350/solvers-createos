import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { guestCommand, withDeadline } from "../src/sandbox/client.js";
import { sandboxConfig } from "../src/sandbox/config.js";
import {
  BASE_EGRESS,
  checkCommand,
  checkPort,
  checkUploads,
  clampTimeout,
  egressFor,
  isEgressRule,
  isIdle,
  MAX_STREAM_BYTES,
  MAX_TIMEOUT_MS,
  runView,
  TRIAL_MAX_TIMEOUT_MS,
  truncateOutput,
  workspacePath,
} from "../src/sandbox/rules.js";

describe("truncateOutput", () => {
  it("keeps short output as is", () => {
    assert.deepEqual(truncateOutput("hello"), { text: "hello", truncated: false });
  });

  it("cuts long output to the byte cap, keeping head and tail with a marker", () => {
    const s = `START${"x".repeat(100_000)}END`;
    const r = truncateOutput(s);
    assert.equal(r.truncated, true);
    assert.ok(r.text.startsWith("START"));
    assert.ok(r.text.endsWith("END"));
    assert.match(r.text, /bytes truncated/);
    assert.ok(Buffer.byteLength(r.text) <= MAX_STREAM_BYTES + 100);
  });

  it("never splits a multi-byte character", () => {
    const r = truncateOutput("é".repeat(20_000), 1_001);
    assert.equal(r.truncated, true);
    assert.ok(!r.text.includes("�"));
  });

  it("runView flags truncation of either stream", () => {
    const v = runView({ stdout: "ok", stderr: "e".repeat(MAX_STREAM_BYTES + 1), exitCode: 2, execMs: 5 });
    assert.equal(v.truncated, true);
    assert.equal(v.exit_code, 2);
    assert.equal(v.stdout, "ok");
  });
});

describe("workspacePath", () => {
  it("resolves relative paths inside /workspace", () => {
    assert.equal(workspacePath("app/index.js"), "/workspace/app/index.js");
    assert.equal(workspacePath("/workspace/a/../b.txt"), "/workspace/b.txt");
    assert.equal(workspacePath("app\\src\\x.ts"), "/workspace/app/src/x.ts");
  });

  it("rejects escapes, other roots, the root itself and NUL", () => {
    for (const bad of ["../etc/passwd", "/etc/passwd", "/workspace", "/workspace/", "/workspacex/a", "a/../../b", "", "a\0b"]) {
      assert.throws(() => workspacePath(bad), Error, bad);
    }
  });

  it("checkUploads validates count, size and duplicates", () => {
    assert.deepEqual(checkUploads([{ path: "a.js", content: "1" }]), [{ path: "/workspace/a.js", content: "1" }]);
    assert.throws(() => checkUploads([{ path: "a.js", content: "" }, { path: "/workspace/a.js", content: "" }]), /Duplicate/);
    assert.throws(() => checkUploads([{ path: "big.txt", content: "x".repeat(1_000_001) }]), /too large/);
    assert.throws(() => checkUploads(Array.from({ length: 51 }, (_, i) => ({ path: `f${i}`, content: "" }))), /At most/);
  });
});

describe("timeouts and limits", () => {
  it("defaults, floors and caps the timeout (lower cap in the trial)", () => {
    assert.equal(clampTimeout(undefined), 60_000);
    assert.equal(clampTimeout(10), 1_000);
    assert.equal(clampTimeout(10_000_000), MAX_TIMEOUT_MS);
    assert.equal(clampTimeout(10_000_000, true), TRIAL_MAX_TIMEOUT_MS);
    assert.equal(clampTimeout(90_000, true), 90_000);
  });

  it("checks commands and ports", () => {
    assert.doesNotThrow(() => checkCommand("node", ["-v"]));
    assert.throws(() => checkCommand("  ", []));
    assert.throws(() => checkCommand("node", ["a\0"]));
    assert.throws(() => checkCommand("node", Array.from({ length: 101 }, () => "x")));
    assert.doesNotThrow(() => checkPort(3000));
    assert.throws(() => checkPort(0));
    assert.throws(() => checkPort(70_000));
    assert.throws(() => checkPort(3000.5));
  });

  it("idle after 30 minutes", () => {
    const now = new Date("2026-10-17T12:00:00Z");
    assert.equal(isIdle(new Date("2026-10-17T11:31:00Z"), now), false);
    assert.equal(isIdle(new Date("2026-10-17T11:29:00Z"), now), true);
  });
});

describe("egress allowlist", () => {
  it("base list: registries and GitHub, never empty (empty would mean open)", () => {
    assert.deepEqual(egressFor(), [...BASE_EGRESS]);
    assert.ok(BASE_EGRESS.includes("registry.npmjs.org:443"));
    assert.ok(BASE_EGRESS.includes("*.githubusercontent.com:443"));
  });

  it("adds valid Solver extras (deduplicated, lowercased) and rejects bad rules", () => {
    assert.deepEqual(egressFor(["API.Stripe.com:443", "pypi.org:443"]), [...BASE_EGRESS, "api.stripe.com:443"]);
    for (const bad of ["*", "stripe.com", "*:443", "http://x.com:443", "x.com:0", "x.com:99999", "*.*.com:443"]) {
      assert.equal(isEgressRule(bad), false, bad);
      assert.throws(() => egressFor([bad]));
    }
  });
});

describe("config and guest command", () => {
  it("simulated unless SANDBOX_MODE=createos with a key", () => {
    assert.equal(sandboxConfig({}).mode, "simulated");
    assert.equal(sandboxConfig({ SANDBOX_MODE: "createos" }).mode, "simulated");
    assert.equal(sandboxConfig({ SANDBOX_MODE: "createos", CREATEOS_SANDBOX_API_KEY: "k" }).mode, "createos");
    assert.equal(sandboxConfig({ VERIFIER_MODE: "createos", CREATEOS_SANDBOX_API_KEY: "k" }).verifierMode, "createos");
    assert.equal(sandboxConfig({}).baseUrl, "https://api-eu.sb.createos.sh");
  });

  it("withDeadline: value in time, null after the deadline (late failure swallowed), early failure rejects", async () => {
    assert.equal(await withDeadline(Promise.resolve(7), 50), 7);
    const late = new Promise<number>((_, reject) => setTimeout(() => reject(new Error("late")), 80));
    assert.equal(await withDeadline(late, 10), null);
    await new Promise((r) => setTimeout(r, 100));
    await assert.rejects(withDeadline(Promise.reject(new Error("early")), 50), /early/);
  });

  it("wraps commands with cwd and a guest-side timeout, passing argv untouched", () => {
    const g = guestCommand("node", ["-e", "console.log('a b')"], { timeoutMs: 1_500, cwd: "/workspace" });
    assert.equal(g.cmd, "bash");
    assert.deepEqual(g.args.slice(2), ["bash", "/workspace", "2", "node", "-e", "console.log('a b')"]);
    assert.match(g.args[1]!, /timeout -k 5/);
  });
});
