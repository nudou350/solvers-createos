import { and, eq } from "drizzle-orm";

import { db, schema } from "../db/index.js";
import { HttpError, notFound } from "../lib/http.js";
import { agentIsAvailable } from "../runtime/availability.js";
import { assertNotPlatformAgent } from "../runtime/platform-agents.js";
import { notListedBlock } from "../store/purchase-rules.js";
import { checkoutBlock } from "./stripe-rules.js";
import type { ChargeIntent } from "./types.js";

// Guards of every purchase (POST /api/checkout), run BEFORE a ledger row is written or anybody is charged. Everything
// comes from the database: the agent, its price in cents, its availability (status and the platform kill switch) and
// the licenses the user already holds.

export type AgentRow = typeof schema.agents.$inferSelect;

export type PreparedCheckout = { intent: ChargeIntent; agent: AgentRow };

export type PrepareDeps = {
  /** The package is loadable on this server (default: the runtime package registry). */
  hasPackage?: (agentId: string) => boolean;
};

let defaultHasPackage: ((agentId: string) => boolean) | null = null;

async function hasPackageDefault(agentId: string): Promise<boolean> {
  if (!defaultHasPackage) {
    const mod = await import("../runtime/packages.js");
    defaultHasPackage = (id) => mod.getPackage(id) !== undefined;
  }
  return defaultHasPackage(agentId);
}

/** Replaces the package check (tests, or a deployment that serves packages from elsewhere). */
export function setPackageCheck(fn: ((agentId: string) => boolean) | null): void {
  defaultHasPackage = fn;
}

export async function findAgentBySlug(slug: string): Promise<AgentRow> {
  const [row] = await db.select().from(schema.agents).where(eq(schema.agents.slug, slug)).limit(1);
  if (!row) throw notFound("Specialist not found");
  return row;
}

/** A license of this agent the user already holds. */
export async function ownedLicenseId(userId: string, agentId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: schema.licenses.id })
    .from(schema.licenses)
    .where(and(eq(schema.licenses.userId, userId), eq(schema.licenses.agentId, agentId)))
    .limit(1);
  return row?.id ?? null;
}

async function creatorUserId(creatorId: string): Promise<string | null> {
  const [row] = await db.select({ userId: schema.creators.userId }).from(schema.creators).where(eq(schema.creators.id, creatorId)).limit(1);
  return row?.userId ?? null;
}

/** Validates what the session user wants to buy and computes exactly what will be charged. */
export async function prepareCheckout(agentSlug: string, userId: string, deps: PrepareDeps = {}): Promise<PreparedCheckout> {
  const agent = await findAgentBySlug(agentSlug);
  assertNotPlatformAgent(agent);
  if (!agentIsAvailable(agent)) {
    throw new HttpError(409, "This specialist is not available for purchase right now.", "agent_unavailable");
  }
  const hasPackage = deps.hasPackage ? deps.hasPackage(agent.id) : await hasPackageDefault(agent.id);
  const listed = notListedBlock({ listed: agent.listed, hasPackage });
  if (listed) throw listed;
  const block = checkoutBlock({
    userId,
    creatorUserId: await creatorUserId(agent.creatorId),
    ownedLicenseId: await ownedLicenseId(userId, agent.id),
    priceCents: agent.priceCents,
  });
  if (block) throw block;
  return { intent: { kind: "license", agentId: agent.id, userId, amountCents: agent.priceCents, currency: "usd" }, agent };
}
