import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import type { SolverPackage } from "./packages.js";
import { trialLimits, type TrialLimits, type TrialUsage } from "./trial.js";
import { type LicenseCheck, type PaidAccess, type PlatformAccess } from "./access-rules.js";
import { isPlatformAgent, isPlatformAgentRow, PLATFORM_AGENT_IDS } from "./platform-agents.js";

export type { PaidAccess, PlatformAccess } from "./access-rules.js";

export type Access =
  | ({ ok: true } & PaidAccess)
  | ({ ok: true } & PlatformAccess)
  | { ok: true; kind: "trial"; trial: TrialLimits; used: number; remaining: number; usage: TrialUsage }
  | { ok: false; reason: "no_trial" | "trial_exhausted"; trial: TrialLimits | null };

type AgentRow = typeof schema.agents.$inferSelect;

/** Lifetime license? The database is the source of truth (licenses are written by the Stripe webhook). */
async function licenseCheck(userId: string, agentId: string): Promise<LicenseCheck> {
  const [row] = await db
    .select({ id: schema.licenses.id })
    .from(schema.licenses)
    .where(and(eq(schema.licenses.userId, userId), eq(schema.licenses.agentId, agentId)))
    .limit(1);
  return row ? { state: "owned", id: row.id } : { state: "none" };
}

/** Paid access without consuming anything: the lifetime license. */
export async function paidAccess(userId: string, agent: AgentRow): Promise<PaidAccess | null> {
  const lic = await licenseCheck(userId, agent.id);
  return lic.state === "owned" ? { kind: "license", licenseId: lic.id } : null;
}

export async function paidAccessById(userId: string, agentId: string): Promise<PaidAccess | null> {
  const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.id, agentId));
  return agent ? paidAccess(userId, agent) : null;
}

/**
 * Is the paid session still valid? License revoked (refund): no (the session is dropped and the activation follows the
 * normal flow). Trial sessions are always valid here.
 */
export async function sessionGrantValid(s: typeof schema.sessions.$inferSelect): Promise<boolean> {
  // Platform Solver: the right is the server's own list.
  if (s.access === "platform") return isPlatformAgent(s.agentId);
  if (s.access === "license") {
    if (!s.licenseId) return false;
    const [lic] = await db.select({ userId: schema.licenses.userId }).from(schema.licenses).where(eq(schema.licenses.id, s.licenseId));
    return lic?.userId === s.userId;
  }
  return s.access === "trial";
}

/**
 * Decides how the user accesses the Solver in this activation: platform Solver (free for any signed-in user, no
 * license nor trial) > lifetime license > free trial (when the Solver has one; uses per user).
 */
export async function resolveAccess(
  userId: string,
  agent: AgentRow,
  pkg: SolverPackage,
  /** `allowTrial: false` (suspended Solver): only paid access counts, never the free trial. */
  opts: { consume: boolean; allowTrial?: boolean },
): Promise<Access> {
  // PLATFORM_AGENTS is the authority (not the manifest field). No license and no trial consumed.
  if (isPlatformAgentRow(agent)) return { ok: true, kind: "platform" };
  const paid = await paidAccess(userId, agent);
  if (paid) return { ok: true, ...paid };
  const trial = opts.allowTrial === false ? null : trialLimits(pkg.manifest);
  if (!trial) return { ok: false, reason: "no_trial", trial: null };
  const [row] = await db
    .select()
    .from(schema.trials)
    .where(and(eq(schema.trials.agentId, agent.id), eq(schema.trials.userId, userId)));
  const used = row?.used ?? 0;
  if (used >= trial.uses) return { ok: false, reason: "trial_exhausted", trial };
  if (!opts.consume) return { ok: true, kind: "trial", trial, used, remaining: trial.uses - used, usage: usageOf(row) };
  // Atomic capped increment, so two concurrent activations never pass the limit.
  const [updated] = await db
    .insert(schema.trials)
    .values({ agentId: agent.id, userId, used: 1 })
    .onConflictDoUpdate({
      target: [schema.trials.agentId, schema.trials.userId],
      set: { used: sql`${schema.trials.used} + 1`, updatedAt: new Date() },
      setWhere: sql`${schema.trials.used} < ${trial.uses}`,
    })
    .returning();
  if (!updated) return { ok: false, reason: "trial_exhausted", trial };
  return { ok: true, kind: "trial", trial, used: updated.used, remaining: trial.uses - updated.used, usage: usageOf(updated) };
}

function usageOf(row: typeof schema.trials.$inferSelect | undefined): TrialUsage {
  return { searchesUsed: row?.searchesUsed ?? 0, toolRuns: row?.toolRuns ?? {} };
}

/** What the user already spent of this Solver's trial. */
export async function trialUsage(userId: string, agentId: string): Promise<{ used: number; usage: TrialUsage }> {
  const [row] = await db
    .select()
    .from(schema.trials)
    .where(and(eq(schema.trials.agentId, agentId), eq(schema.trials.userId, userId)));
  return { used: row?.used ?? 0, usage: usageOf(row) };
}

const trialKey = (userId: string, agentId: string) => and(eq(schema.trials.agentId, agentId), eq(schema.trials.userId, userId));

/** Consumes 1 trial knowledge search (atomic, capped). false: no searches left. */
export async function consumeTrialSearch(userId: string, agentId: string, limit: number): Promise<boolean> {
  const rows = await db
    .update(schema.trials)
    .set({ searchesUsed: sql`${schema.trials.searchesUsed} + 1`, updatedAt: new Date() })
    .where(and(trialKey(userId, agentId), sql`${schema.trials.searchesUsed} < ${limit}`))
    .returning({ n: schema.trials.searchesUsed });
  return rows.length > 0;
}

const runsOf = (tool: string) => sql`coalesce((${schema.trials.toolRuns} ->> ${tool})::int, 0)`;

/** Consumes 1 trial tool run (atomic, capped). false: limit reached. */
export async function consumeTrialTool(userId: string, agentId: string, tool: string, limit: number): Promise<boolean> {
  const rows = await db
    .update(schema.trials)
    .set({
      toolRuns: sql`jsonb_set(${schema.trials.toolRuns}, array[${tool}]::text[], to_jsonb(${runsOf(tool)} + 1))`,
      updatedAt: new Date(),
    })
    .where(and(trialKey(userId, agentId), sql`${runsOf(tool)} < ${limit}`))
    .returning({ agentId: schema.trials.agentId });
  return rows.length > 0;
}

/** Gives the run back when the tool refused the input (the AI fixes it and retries without losing the use). */
export async function refundTrialTool(userId: string, agentId: string, tool: string): Promise<void> {
  await db
    .update(schema.trials)
    .set({ toolRuns: sql`jsonb_set(${schema.trials.toolRuns}, array[${tool}]::text[], to_jsonb(${runsOf(tool)} - 1))` })
    .where(and(trialKey(userId, agentId), sql`${runsOf(tool)} > 0`));
}

/** Solvers the user holds a license of (database only). */
export async function ownedLicensedAgents(userId: string): Promise<Set<string>> {
  const lic = await db
    .select({ agentId: schema.licenses.agentId })
    .from(schema.licenses)
    .where(eq(schema.licenses.userId, userId));
  return new Set(lic.map((l) => l.agentId));
}

/** Solvers the user can use without buying: its licenses and the free platform Solvers, which any signed-in user can use. */
export async function ownedAgents(userId: string): Promise<Set<string>> {
  return new Set([...(await ownedLicensedAgents(userId)), ...PLATFORM_AGENT_IDS]);
}
