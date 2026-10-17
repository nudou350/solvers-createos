import { z } from "zod";
import { badRequest } from "../lib/http.js";
import { runTests } from "../verifier/sandbox.js";
import type { SolverPackage } from "./packages.js";
import type { TrialLimits } from "./trial.js";
import { a11yCheck, budgetSplit, contrastCheck, normalizeFiles } from "./tool-fns.js";
import { validatePackageTool } from "./validate-package-tool.js";

// Server tools declared in the manifest (run_tool). The solver's value lives here:
// the user's AI has no access to these runs without the license.

type Runner = (input: unknown) => Promise<unknown>;

/** Runner of the CreateOS sandbox tools (sandbox_run, sandbox_preview, ...): needs the caller's session. */
export const SANDBOX_RUNNER = "builtin:sandbox";

/**
 * Who runs the tool. The sandbox runner needs it (the sandbox belongs to the session) and enforces its own free-trial
 * run limit from `trial`, counting only explicit runs: the `verify` checks of next_step never go through here.
 */
export type ServerToolCtx = { userId: string; sessionId: string; agentId: string; trial: TrialLimits | null };

// Pure functions (no env/database) live in tool-fns.ts; re-exported for the verifier.
export { a11yCheck, contrastRatio } from "./tool-fns.js";

const dockerReactTest: Runner = async (input) => (await runTests(normalizeFiles(input))).report;
const a11y: Runner = async (input) => a11yCheck(normalizeFiles(input));
const contrast: Runner = async (input) => contrastCheck(input);
const budget: Runner = async (input) => budgetSplit(input);

// Built-in runners (PACKAGE_SPEC.md 8.1): `builtin:<name>` and the old names as aliases. ONLY platform packages
// (AGENTS_DIR) may use them; a creator package with a built-in runner is rejected in runServerTool.
const RUNNERS: Record<string, Runner> = {
  "builtin:docker-react-test": dockerReactTest,
  "builtin:a11y": a11y,
  "builtin:contrast": contrast,
  "builtin:budget": budget,
  "builtin:validate-package": async (input) => validatePackageTool(input),
  "docker:solvers-react-test": dockerReactTest,
  "node:a11y": a11y,
  "node:contrast": contrast,
  "node:budget": budget,
};

export async function runServerTool(pkg: SolverPackage, toolName: string, input: unknown, ctx?: ServerToolCtx) {
  const tool = pkg.manifest.tools.find((t) => t.name === toolName);
  if (!tool) {
    const names = pkg.manifest.tools.map((t) => t.name).join(", ") || "none";
    throw badRequest(`Tool "${toolName}" does not exist in this solver. Available: ${names}`);
  }
  const runner: Runner | undefined =
    tool.runner === SANDBOX_RUNNER
      ? async (i) => {
          if (!ctx) throw badRequest(`${toolName} needs an active session: call it with the session_id from activate_solver.`);
          // Loaded on use: the sandbox tools live with the MCP layer, which imports this module.
          const { runSandboxTool } = await import("../mcp/sandbox-tools.js");
          return runSandboxTool(toolName, i, ctx);
        }
      : RUNNERS[tool.runner];
  // A creator package (PUBLISHED_DIR) never runs a built-in runner: it would hog the sandbox or the server's validation.
  if (!runner || pkg.source === "published") throw badRequest(`Runner ${tool.runner} is not available on this server`);
  try {
    return await runner(input);
  } catch (e) {
    if (e instanceof z.ZodError) {
      throw badRequest(`Invalid input for ${toolName}: ${e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }
    throw e;
  }
}
