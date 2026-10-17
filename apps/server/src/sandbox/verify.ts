import { expectedExit, type StepVerifyOutcome, type VerifyCheck, type VerifyResult } from "@solvers/shared";
import { sandboxPool } from "./deps.js";
import { sandboxHttpError, type Pool } from "./pool.js";
import { truncateOutput, VERIFY_TIMEOUT_MS, WORKSPACE } from "./rules.js";

// Step gates proven by execution (PLANO.md 6.3): each `verify` check of a step runs in the session's sandbox (created
// on the first call) from /workspace. Checks run in order and stop at the first failure (later checks usually depend
// on it, and each may take minutes). Every run is logged in sandbox_runs with kind "verify"; none spends a trial run.

export type StepVerifyInput = { userId: string; sessionId: string; agentId: string; checks: VerifyCheck[] };

export async function verifyChecks(pool: Pool, input: StepVerifyInput): Promise<StepVerifyOutcome> {
  if (input.checks.length === 0) return { passed: true, results: [] };
  try {
    const lease = await pool.session(input.userId, input.sessionId);
    const results: VerifyResult[] = [];
    for (const check of input.checks) {
      const out = await pool.run(lease, check.command, check.args ?? [], { timeoutMs: VERIFY_TIMEOUT_MS, cwd: WORKSPACE }, { userId: input.userId, agentId: input.agentId, kind: "verify" });
      const passed = out.exitCode === expectedExit(check);
      results.push({ label: check.label, passed, exitCode: out.exitCode, stdout: truncateOutput(out.stdout).text, stderr: truncateOutput(out.stderr).text, execMs: Math.max(0, Math.round(out.execMs)) });
      if (!passed) return { passed: false, results };
    }
    return { passed: true, results };
  } catch (e) {
    throw sandboxHttpError(e) ?? e;
  }
}

export async function runStepVerify(input: StepVerifyInput): Promise<StepVerifyOutcome> {
  return verifyChecks(await sandboxPool(), input);
}
