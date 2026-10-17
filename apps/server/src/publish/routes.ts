import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { PublicationResult, SubmissionStatus } from "@solvers/shared";
import { requireUser } from "../auth/middleware.js";
import { db, schema } from "../db/index.js";
import { h, notFound, parse } from "../lib/http.js";
import { requireAdminUser } from "./admin.js";
import { finalizePublication, type FinalizeResult } from "./finalize.js";

// Publication area (PACKAGE_SPEC.md 15). The reviewer's approval already publishes (submissions/review.ts); this route is
// the admin's retry. Mounted under /api by modules.ts:
//   POST /admin/submissions/:id/finish   (site admin) -> PublicationResult
export const publishRouter: Router = Router();

/** The submission's state after a finalization attempt, in the shape the web and the api-client read. */
export async function publicationResult(submissionId: string, result: FinalizeResult): Promise<PublicationResult> {
  const [row] = await db
    .select({ status: schema.packageSubmissions.status, error: schema.packageSubmissions.error })
    .from(schema.packageSubmissions)
    .where(eq(schema.packageSubmissions.id, submissionId));
  const error = result.outcome === "failed" ? result.error : result.outcome === "not_ready" ? result.reason : (row?.error ?? null);
  return { submissionId, status: (row?.status ?? "submitted") as SubmissionStatus, outcome: result.outcome, error };
}

/** Finishes a publication that failed (`publish_failed`) or whose process died (`publishing`). Idempotent. */
publishRouter.post(
  "/admin/submissions/:id/finish",
  requireUser,
  h(async (req) => {
    requireAdminUser(req.userId);
    const id = String(parse(z.object({ id: z.string().min(1).max(64) }), req.params).id);
    const [sub] = await db.select({ id: schema.packageSubmissions.id }).from(schema.packageSubmissions).where(eq(schema.packageSubmissions.id, id));
    if (!sub) throw notFound("Submission not found");
    const result = await finalizePublication(id, { actor: req.userId });
    return publicationResult(id, result);
  }),
);
