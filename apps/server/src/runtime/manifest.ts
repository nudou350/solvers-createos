import { z } from "zod";
import { FREE_TRIAL_USES, ManifestPricing, ManifestStep, Requirement } from "@solvers/shared";
import { AGENT_ID_RE, slugProblem, versionProblem } from "./agent-ids.js";

// Schema of the packages' manifest.json (INSTRUCTIONS.md 6). No env/database: also validated in the tests.

export { VerifyCheck } from "@solvers/shared";

/** Manifest shape (without the cross-field checks): the v1 validator extends this base. */
export const ManifestBase = z.object({
  id: z.string().regex(AGENT_ID_RE),
  /** Becomes a folder name and a lookup key: strict format and never equal to an `id` (PACKAGE_SPEC.md 4.1). */
  slug: z.string().superRefine((s, ctx) => {
    const why = slugProblem(s);
    if (why) ctx.addIssue({ code: "custom", message: why });
  }),
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
  category: z.string(),
  version: z.string().superRefine((v, ctx) => {
    const why = versionProblem(v);
    if (why) ctx.addIssue({ code: "custom", message: why });
  }),
  catalogOnly: z.boolean().optional(),
  /** Uses get_memory/save_memory (if absent, inferred from the steps). */
  usesMemory: z.boolean().optional(),
  creator: z.object({ id: z.string(), name: z.string(), bio: z.string(), avatarUrl: z.string().nullable().optional() }),
  requirements: z.array(Requirement),
  packageContents: z.array(z.string()),
  /** `verify`: checks run in the session's sandbox before the step advances (gates proven by execution). */
  steps: z.array(ManifestStep),
  tools: z.array(z.object({ name: z.string(), description: z.string(), runner: z.string() })).default([]),
  /** Lifetime license price in USD cents (at least MIN_PRICE_CENTS, or 0 for a free platform Solver). */
  pricing: ManifestPricing,
  /** Free trial with limits enforced by the server. Absent or available=false: no trial. */
  trial: z
    .object({
      available: z.boolean().default(true),
      uses: z.number().int().min(1).max(10).default(FREE_TRIAL_USES),
      /** Initial steps unlocked. */
      steps: z.number().int().min(1),
      /** Total search_knowledge calls in the whole trial. */
      searches: z.number().int().min(0),
      /** Total runs per tool in the whole trial; a tool not listed is blocked. */
      tools: z.record(z.number().int().min(0)).default({}),
      /** Input cap of each tool during the trial (the license has none): files and bytes per run. */
      toolLimits: z
        .record(z.object({ maxFiles: z.number().int().min(1).optional(), maxBytes: z.number().int().min(1).optional() }))
        .default({}),
      /** Agreed request size during the trial, passed on to the AI (e.g. "1 component per use"). */
      scope: z.string().min(3).max(300).optional(),
      summary: z.string().min(3).max(400),
      lockedSummary: z.string().min(3).max(300),
    })
    .optional(),
  /** Typical requests in the buyer's own words ("I want a nice website"): each one becomes a search vector. */
  searchPhrases: z.array(z.string().min(3).max(120)).max(20).default([]),
  beforeAfter: z.array(z.object({ prompt: z.string(), withoutSolver: z.string(), withSolver: z.string() })).default([]),
  versions: z
    .array(z.object({ version: z.string(), releasedAt: z.string(), notes: z.string() }))
    .default([]),
});

/** Cross-field checks (free trial vs steps and tools). */
export function manifestCrossChecks(m: z.infer<typeof ManifestBase>, ctx: z.RefinementCtx): void {
  if (!m.trial) return;
  if (m.trial.steps > m.steps.length) {
    ctx.addIssue({ code: "custom", path: ["trial", "steps"], message: `trial.steps (${m.trial.steps}) is greater than the number of steps (${m.steps.length})` });
  }
  for (const name of Object.keys(m.trial.tools)) {
    if (!m.tools.some((t) => t.name === name)) {
      ctx.addIssue({ code: "custom", path: ["trial", "tools", name], message: `trial.tools: tool "${name}" does not exist in tools` });
    }
  }
  for (const name of Object.keys(m.trial.toolLimits)) {
    if (!m.tools.some((t) => t.name === name)) {
      ctx.addIssue({ code: "custom", path: ["trial", "toolLimits", name], message: `trial.toolLimits: tool "${name}" does not exist in tools` });
    }
  }
}

export const Manifest = ManifestBase.superRefine(manifestCrossChecks);
export type Manifest = z.infer<typeof Manifest>;
