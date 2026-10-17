// Pure paid-access rules (no env/database), tested in test/trial.test.ts.

/** Paid access: lifetime license (no trial limits). */
export type PaidAccess = { kind: "license"; licenseId: string };

/** Free access to a platform Solver (PLATFORM_AGENTS): no license, no free trial and no use counter. */
export type PlatformAccess = { kind: "platform" };

/** Result of the license check: owned or not owned. */
export type LicenseCheck = { state: "owned"; id: string } | { state: "none" };

/** activate_solver access line for paid access (or the free access of a platform Solver). */
export function paidAccessLine(kind: PaidAccess["kind"] | PlatformAccess["kind"]): string {
  if (kind === "platform") return "Access: free (platform Solver, no license and no trial limits).";
  return "Access: lifetime license.";
}
