import { test } from "node:test";
import assert from "node:assert/strict";
import { ManifestPricing, ManifestStep, StepVerifyOutcome, VerifyCheck, VerifyResult, expectedExit, unmatchedVerifyLabels } from "./manifest.js";

const step = {
  file: "steps/04-deploy.md",
  title: "Deploy and prove it runs",
  gate: ["Build passes in the sandbox", "Health endpoint answers 200"],
  verify: [
    { label: "Build passes in the sandbox", command: "bash", args: ["-lc", "cd /workspace && npm run build"], expectExit: 0 },
    { label: "Health endpoint answers 200", command: "bash", args: ["-lc", "curl -fsS localhost:3000/health"] },
  ],
};

test("ManifestStep with verify checks", () => {
  const s = ManifestStep.parse(step);
  assert.equal(s.verify?.length, 2);
  assert.equal(expectedExit(s.verify![0]!), 0);
  assert.equal(expectedExit(s.verify![1]!), 0);
  assert.equal(expectedExit({ label: "x", command: "false", expectExit: 1 }), 1);
  assert.deepEqual(unmatchedVerifyLabels(s), []);
  assert.deepEqual(unmatchedVerifyLabels({ gate: ["A"], verify: [{ label: "B", command: "true" }] }), ["B"]);
  assert.deepEqual(ManifestStep.parse({ file: "steps/01.md" }).gate, []);
  assert.equal(ManifestStep.parse({ file: "steps/01.md" }).verify, undefined);
});

test("VerifyCheck rejects bad shapes", () => {
  for (const bad of [{ label: "", command: "x" }, { label: "a", command: "" }, { label: "a", command: "x", expectExit: -1 }, { label: "a", command: "x", args: "y" }]) {
    assert.equal(VerifyCheck.safeParse(bad).success, false, JSON.stringify(bad));
  }
});

test("VerifyResult and the step outcome", () => {
  const r = { label: "Build passes in the sandbox", passed: true, exitCode: 0, stdout: "ok", stderr: "", execMs: 1234 };
  assert.deepEqual(VerifyResult.parse(r), r);
  assert.deepEqual(StepVerifyOutcome.parse({ passed: true, results: [r] }).results, [r]);
});

test("pricing in cents, minimum US$ 5 (0 = free platform Solver)", () => {
  assert.equal(ManifestPricing.parse({ priceCents: 900 }).priceCents, 900);
  assert.equal(ManifestPricing.parse({ priceCents: 0 }).priceCents, 0);
  for (const p of [1, 499, 9.5, "900", -500]) assert.equal(ManifestPricing.safeParse({ priceCents: p }).success, false, String(p));
});
