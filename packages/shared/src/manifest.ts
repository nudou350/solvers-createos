import { z } from "zod";
import { MIN_PRICE_CENTS } from "./money.js";

// Manifest pieces shared by the server (runtime/manifest.ts owns the full schema), the web and package tooling
// (docs/package-spec.md). Gates proven by execution: each `steps[].verify` check runs in the session's sandbox before
// the step advances; `label` matches a line of the step's human-readable `gate`.

/** One check of a step gate: `command args...` must exit with `expectExit` (default 0). */
export const VerifyCheck = z.object({
  label: z.string().trim().min(1).max(200),
  command: z.string().min(1).max(200),
  args: z.array(z.string().max(4000)).max(50).optional(),
  expectExit: z.number().int().min(0).max(255).optional(),
});
export type VerifyCheck = z.infer<typeof VerifyCheck>;

/** Outcome of one check (the proof shown to the user, or the output returned to the model when it fails). */
export const VerifyResult = z.object({
  label: z.string(),
  passed: z.boolean(),
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
  execMs: z.number().int().nonnegative(),
});
export type VerifyResult = z.infer<typeof VerifyResult>;

/** Outcome of every check of a step (`runStepVerify`): passed only when all checks passed. */
export const StepVerifyOutcome = z.object({ passed: z.boolean(), results: z.array(VerifyResult) });
export type StepVerifyOutcome = z.infer<typeof StepVerifyOutcome>;

/** Manifest `steps[]` entry. */
export const ManifestStep = z.object({
  file: z.string(),
  title: z.string().optional(),
  gate: z.array(z.string()).default([]),
  verify: z.array(VerifyCheck).max(10).optional(),
});
export type ManifestStep = z.infer<typeof ManifestStep>;

/** Manifest `pricing`: lifetime license price in integer USD cents (minimum US$ 5; 0 only for a free platform Solver). */
export const ManifestPricing = z.object({
  priceCents: z
    .number()
    .int()
    .refine((c) => c === 0 || c >= MIN_PRICE_CENTS, `priceCents must be at least ${MIN_PRICE_CENTS} (or 0 for a free platform Solver)`),
});
export type ManifestPricing = z.infer<typeof ManifestPricing>;

/** Exit code a check expects (`expectExit`, default 0). */
export function expectedExit(check: VerifyCheck): number {
  return check.expectExit ?? 0;
}

/** Verify labels that do not match any line of the step's `gate` (the validator warns about them). */
export function unmatchedVerifyLabels(step: Pick<ManifestStep, "gate" | "verify">): string[] {
  const gate = new Set(step.gate.map((g) => g.trim()));
  return (step.verify ?? []).map((v) => v.label).filter((l) => !gate.has(l.trim()));
}
