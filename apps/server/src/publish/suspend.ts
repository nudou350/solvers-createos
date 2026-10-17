import { and, desc, eq, or } from "drizzle-orm";
import { db, schema } from "../db/index.js";

// The admin kill switch (PACKAGE_SPEC.md 15.4): `cli:suspend <slug>` and `cli:suspend <slug> --resume`.
//  1. `agents.platform_status`: cuts open sessions, the store and sales at once (`getSession`, the checkout and the rest
//     check the column on every call).
//  2. Audit: a `suspend`/`resume` row in `package_reviews` (insert-only) and the submission `published` <-> `suspended`.
// Database only, in one transaction. Running it again when already in that state changes nothing (no duplicate audit row).

export class SuspendError extends Error {}

type AgentRow = typeof schema.agents.$inferSelect;

export type SuspendResult = {
  agentId: string;
  slug: string;
  action: "suspend" | "resume";
  /** The database changed (platform_status). */
  platformChanged: boolean;
  submissionId: string | null;
};

export async function findAgentByRef(ref: string): Promise<AgentRow> {
  const [row] = await db
    .select()
    .from(schema.agents)
    .where(or(eq(schema.agents.slug, ref), eq(schema.agents.id, ref)));
  if (!row) throw new SuspendError(`Solver "${ref}" not found (use the slug or the id)`);
  return row;
}

/** Submission that reflects the live Solver: the latest `published` (when suspending) or `suspended` (when resuming). */
async function currentSubmission(agentId: string, status: "published" | "suspended") {
  const t = schema.packageSubmissions;
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.agentId, agentId), eq(t.status, status)))
    .orderBy(desc(t.createdAt))
    .limit(1);
  return row ?? null;
}

/** `actor`: admin user id recorded in the audit trail. */
export async function suspendSolver(ref: string, opts: { actor: string; resume?: boolean; reason?: string }): Promise<SuspendResult> {
  const agent = await findAgentByRef(ref);
  const resume = opts.resume === true;
  const reason = opts.reason?.trim() || (resume ? "Resumed by the admin" : "Suspended by the admin");
  const actor = opts.actor;
  const result: SuspendResult = { agentId: agent.id, slug: agent.slug, action: resume ? "resume" : "suspend", platformChanged: false, submissionId: null };
  await markPlatform(
    agent,
    resume ? "active" : "suspended",
    result,
    resume ? { from: "suspended", to: "published", action: "resume", reason, actor } : { from: "published", to: "suspended", action: "suspend", reason, actor },
  );
  return result;
}

async function markPlatform(
  agent: AgentRow,
  to: "active" | "suspended",
  result: SuspendResult,
  audit: { from: "published" | "suspended"; to: "published" | "suspended"; action: "suspend" | "resume"; reason: string; actor: string },
): Promise<void> {
  const changed = agent.platformStatus !== to;
  result.platformChanged = changed;
  if (!changed) return; // already like this: no duplicate audit row
  const sub = await currentSubmission(agent.id, audit.from);
  result.submissionId = sub?.id ?? null;
  await db.transaction(async (tx) => {
    await tx.update(schema.agents).set({ platformStatus: to, updatedAt: new Date() }).where(eq(schema.agents.id, agent.id));
    if (sub) {
      await tx
        .update(schema.packageSubmissions)
        .set({ status: audit.to, updatedAt: new Date() })
        .where(and(eq(schema.packageSubmissions.id, sub.id), eq(schema.packageSubmissions.status, audit.from)));
    }
    await tx.insert(schema.packageReviews).values({
      // Solver without a submission (platform package published by the CLI): the trail goes under the agent id.
      submissionId: sub?.id ?? `agent:${agent.id}`,
      reviewerUserId: audit.actor,
      action: audit.action,
      notes: audit.reason,
      versionHash: agent.versionHash,
    });
  });
}
