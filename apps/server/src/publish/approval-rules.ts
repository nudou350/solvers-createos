import type { SubmissionStatus } from "@solvers/shared";

// Pure rules of the publication (PACKAGE_SPEC.md 15.2 and 15.3). No env, database or network: tested in
// test/publish-rules.test.ts. Everything starts from the approved version, frozen at approval; publishing is a database
// state change (the reviewer's approval moves the submission to `publishing` and the server finishes it on its own).

/** Approved version, as `package_submissions.approved` stores it (price in integer USD cents). */
export type ApprovedRecord = {
  versionHash: string;
  priceCents: number;
  name: string;
  version: string;
};

/** `approved` from the jsonb column: checks the shape before trusting it (the publication reads everything from here). */
export function parseApproved(raw: unknown): ApprovedRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.versionHash === "string" &&
    /^[0-9a-f]{64}$/.test(r.versionHash) &&
    typeof r.priceCents === "number" &&
    Number.isSafeInteger(r.priceCents) &&
    r.priceCents >= 0 &&
    typeof r.name === "string" &&
    r.name.length > 0 &&
    typeof r.version === "string" &&
    r.version.length > 0
  ) {
    return { versionHash: r.versionHash, priceCents: r.priceCents, name: r.name, version: r.version };
  }
  return null;
}

/** States finalization can start from (`publishing`: right after the approval, or resuming a process that died). */
export const FINALIZABLE_STATUSES: readonly SubmissionStatus[] = ["publishing", "publish_failed"];
