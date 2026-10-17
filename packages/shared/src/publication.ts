import { z } from "zod";
import { SubmissionStatus } from "./submissions.js";

// Publication contract (docs/package-spec.md 15): once the reviewer approves a submission, the server publishes it on
// its own (`publishing` -> `published`); the admin can retry a failed one. Single source for server, api-client and
// web. No I/O.

/** Outcome of the completion (approval and POST /api/admin/submissions/:id/finish). */
export const FINALIZE_OUTCOMES = ["published", "already_published", "busy", "not_ready", "failed"] as const;
export const FinalizeOutcome = z.enum(FINALIZE_OUTCOMES);
export type FinalizeOutcome = z.infer<typeof FinalizeOutcome>;

export const PublicationResult = z.object({
  submissionId: z.string(),
  /** Submission status AFTER the call. */
  status: SubmissionStatus,
  outcome: FinalizeOutcome,
  error: z.string().nullable(),
});
export type PublicationResult = z.infer<typeof PublicationResult>;
