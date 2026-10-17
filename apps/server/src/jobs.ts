import { and, eq, sql } from "drizzle-orm";
import { DELIST_MAX_RATING, DELIST_MIN_REVIEWS } from "@solvers/shared";

import { db, schema } from "./db/index.js";
import { every, type Job } from "./lib/jobs.js";
import { notifyCreator } from "./notify/telegram.js";
import { paymentsJobs } from "./payments/jobs.js";
import { destroyIdleSandboxes } from "./sandbox/jobs.js";
import { cleanupSubmissionsOnce } from "./submissions/cleanup.js";

// Periodic jobs of the API process (every area's jobs are listed here; the worker has its own):
// - payments (every 5 min): settles Stripe Checkout Sessions left pending and finishes interrupted fulfilments.
// - idle sandboxes (every minute): destroys CreateOS sandboxes nobody used for a while (sandbox/jobs.ts), so the free
//   plan's single concurrent sandbox is freed.
// - storefront (hourly): delists Solvers with a low rating after 10 reviews.
// - submissions cleanup (every 6 h): expires stale submissions, deletes rejected ZIPs, orphan folders and `.part` files.

/**
 * Storefront quality: a Solver whose average rating is below DELIST_MAX_RATING after DELIST_MIN_REVIEWS reviews leaves
 * the storefront (it keeps working for whoever already bought it).
 */
export async function delistLowRatedOnce(): Promise<number> {
  const rows = await db
    .update(schema.agents)
    .set({ listed: false, updatedAt: new Date() })
    .where(
      and(
        eq(schema.agents.listed, true),
        sql`${schema.agents.ratingCount} >= ${DELIST_MIN_REVIEWS}`,
        sql`${schema.agents.ratingSum}::float / nullif(${schema.agents.ratingCount}, 0) < ${DELIST_MAX_RATING}`,
      ),
    )
    .returning({ id: schema.agents.id, name: schema.agents.name });
  for (const r of rows) {
    void notifyCreator(r.id, `Solvers: "${r.name}" was removed from the storefront because its average rating dropped below ${DELIST_MAX_RATING}. People who already bought it can keep using it normally.`);
  }
  return rows.length;
}

export const jobs: Job[] = [
  ...paymentsJobs,
  every(60_000, "sandboxes: destroy idle", destroyIdleSandboxes),
  every(60 * 60_000, "storefront: low rating", delistLowRatedOnce),
  every(6 * 60 * 60_000, "submissions cleanup", cleanupSubmissionsOnce),
];
