import { Router } from "express";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { averageRating, bpsToScore, PLATFORM_FEE_BPS, MAX_BPS, type ConnectorStatus, type CreatorDashboard, type Memory } from "@solvers/shared";
import { db, schema } from "../db/index.js";
import { env } from "../env.js";
import { requireUser, requireUserId } from "../auth/middleware.js";
import { h, notFound } from "../lib/http.js";
import { deleteAllMemories, deleteMemory, memoryKeyFor, readMemories } from "../memory/crypto.js";
import { getCreator } from "./catalog.js";
import { catalogLangOf } from "./lang-rules.js";
import { currentEvalBps } from "./mappers.js";

export const meRouter = Router();

// ---------- Memories (storefront) ----------

meRouter.get(
  "/me/memories",
  requireUser,
  h(async (req): Promise<Memory[]> => {
    const userId = requireUserId(req);
    const mems = await readMemories(userId, await memoryKeyFor(userId));
    return mems.map((m) => ({ id: m.id, agentId: m.agentId, summary: m.summary, profile: m.profile, notes: m.notes, updatedAt: m.updatedAt.toISOString() }));
  }),
);

meRouter.get(
  "/me/memories/count",
  requireUser,
  h(async (req) => {
    const userId = requireUserId(req);
    const rows = await db
      .select({ agentId: schema.memories.agentId, updatedAt: schema.memories.updatedAt })
      .from(schema.memories)
      .where(eq(schema.memories.userId, userId));
    return { count: rows.length, agents: rows.map((r) => ({ agentId: r.agentId, updatedAt: r.updatedAt.toISOString() })) };
  }),
);

meRouter.delete(
  "/me/memories/:id",
  requireUser,
  h(async (req) => {
    if (!(await deleteMemory(requireUserId(req), String(req.params.id)))) throw notFound("Memory not found");
    return { ok: true };
  }),
);

meRouter.delete(
  "/me/memories",
  requireUser,
  h(async (req) => {
    await deleteAllMemories(requireUserId(req));
    return { ok: true };
  }),
);

// ---------- Connector ----------

meRouter.get(
  "/connector",
  requireUser,
  h(async (req): Promise<ConnectorStatus> => {
    const userId = requireUserId(req);
    const rows = await db
      .select({ clientId: schema.oauthTokens.clientId, createdAt: schema.oauthTokens.createdAt, metadata: schema.oauthClients.metadata })
      .from(schema.oauthTokens)
      .innerJoin(schema.oauthClients, eq(schema.oauthClients.clientId, schema.oauthTokens.clientId))
      .where(and(eq(schema.oauthTokens.userId, userId), eq(schema.oauthTokens.revoked, false), gt(schema.oauthTokens.expiresAt, new Date())))
      .orderBy(desc(schema.oauthTokens.createdAt));
    const seen = new Set<string>();
    const authorizedClients = rows
      .filter((r) => (seen.has(r.clientId) ? false : seen.add(r.clientId)))
      .map((r) => ({ clientName: String((r.metadata as { client_name?: string }).client_name ?? "AI assistant"), authorizedAt: r.createdAt.toISOString() }));
    return { url: `${env.PUBLIC_API_URL.replace(/\/$/, "")}/mcp`, authorizedClients };
  }),
);

meRouter.post(
  "/connector/revoke",
  requireUser,
  h(async (req) => {
    const userId = requireUserId(req);
    const toks = await db
      .update(schema.oauthTokens)
      .set({ revoked: true })
      .where(and(eq(schema.oauthTokens.userId, userId), eq(schema.oauthTokens.revoked, false)))
      .returning({ id: schema.oauthTokens.id });
    return { revoked: toks.length };
  }),
);

// ---------- Creator dashboard ----------

type DashAgent = CreatorDashboard["agents"][number];

meRouter.get(
  "/creator/dashboard",
  requireUser,
  h(async (req, res): Promise<CreatorDashboard> => {
    const userId = requireUserId(req);
    const lang = catalogLangOf(req, res);
    const [creatorRow] = await db.select().from(schema.creators).where(eq(schema.creators.userId, userId));
    const creatorSharePct = (MAX_BPS - PLATFORM_FEE_BPS) / 100;
    const empty: CreatorDashboard = {
      creator: null,
      totals: { sales: 0, uses: 0, salesRevenueCents: 0 },
      last30: { sales: 0, uses: 0, revenueCents: 0 },
      creatorSharePct,
      agents: [],
      daily: [],
    };
    if (!creatorRow) return empty;
    const agents = await db.select().from(schema.agents).where(eq(schema.agents.creatorId, creatorRow.id));
    if (agents.length === 0) return { ...empty, creator: await getCreator(creatorRow.id, lang) };
    const ids = agents.map((a) => a.id);

    // Paid license sales (Stripe Checkout fulfilled). The creator's share of each sale is the amount minus the platform
    // fee, floored like `feeSplit` (the rounding remainder goes to the creator).
    const ledger = schema.paymentLedger;
    const sold = and(inArray(ledger.agentId, ids), eq(ledger.kind, "license"), eq(ledger.status, "fulfilled"));
    const when = sql`coalesce(${ledger.fulfilledAt}, ${ledger.createdAt})`;
    const creatorCut = sql`(${ledger.amountCents} - div(${ledger.amountCents} * ${sql.raw(String(PLATFORM_FEE_BPS))}, ${sql.raw(String(MAX_BPS))}))`;
    const paid = await db
      .select({ agentId: ledger.agentId, sales: sql<number>`count(*)`.mapWith(Number), cents: sql<number>`coalesce(sum(${creatorCut}), 0)`.mapWith(Number) })
      .from(ledger)
      .where(sold)
      .groupBy(ledger.agentId);
    const paidBy = new Map(paid.map((p) => [p.agentId, p]));

    const perAgent: DashAgent[] = agents.map((a) => ({
      agentId: a.id,
      slug: a.slug,
      name: (lang === "pt" ? a.translations?.pt?.name : undefined) || a.name,
      category: a.category,
      version: a.version,
      status: a.platformStatus === "active" ? "active" : "suspended",
      listed: a.listed,
      userRating: averageRating(a.ratingSum, a.ratingCount),
      evalScore: bpsToScore(currentEvalBps(a)),
      sales: paidBy.get(a.id)?.sales ?? 0,
      uses: Number(a.verifiedUses),
      revenueCents: paidBy.get(a.id)?.cents ?? 0,
      priceCents: a.priceCents,
    }));

    const daily = await db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${when}), 'YYYY-MM-DD')`,
        sales: sql<number>`count(*)`.mapWith(Number),
        revenue: sql<number>`coalesce(sum(${creatorCut}), 0)`.mapWith(Number),
      })
      .from(ledger)
      .where(and(sold, gt(when, sql`now() - interval '30 days'`)))
      .groupBy(sql`1`)
      .orderBy(sql`1`);
    const usesDaily = await db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${schema.usageEvents.createdAt}), 'YYYY-MM-DD')`,
        uses: sql<number>`count(*)`.mapWith(Number),
      })
      .from(schema.usageEvents)
      .where(and(inArray(schema.usageEvents.agentId, ids), eq(schema.usageEvents.tool, "activate_solver"), gt(schema.usageEvents.createdAt, sql`now() - interval '30 days'`)))
      .groupBy(sql`1`);
    const usesBy = new Map(usesDaily.map((u) => [u.date, u.uses]));
    const salesBy = new Map(daily.map((d) => [d.date, d]));
    const dates = new Set([...daily.map((d) => d.date), ...usesDaily.map((u) => u.date)]);
    const dailyOut = [...dates].sort().map((date) => ({
      date,
      sales: salesBy.get(date)?.sales ?? 0,
      uses: usesBy.get(date) ?? 0,
      revenueCents: salesBy.get(date)?.revenue ?? 0,
    }));

    const count = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
    return {
      creator: await getCreator(creatorRow.id, lang),
      totals: {
        sales: count(perAgent, (a) => a.sales),
        uses: count(perAgent, (a) => a.uses),
        salesRevenueCents: count(perAgent, (a) => a.revenueCents),
      },
      last30: {
        sales: count(dailyOut, (d) => d.sales),
        uses: count(dailyOut, (d) => d.uses),
        revenueCents: count(dailyOut, (d) => d.revenueCents),
      },
      creatorSharePct,
      agents: perAgent,
      daily: dailyOut,
    };
  }),
);
