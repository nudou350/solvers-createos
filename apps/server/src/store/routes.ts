import { Router } from "express";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import type { AgentAccess, License, MyTrial, Profile, UsageSummary } from "@solvers/shared";
import { requireUser, requireUserId } from "../auth/middleware.js";
import { db, schema } from "../db/index.js";
import { searchAgentRows } from "../knowledge/search.js";
import { h, parse } from "../lib/http.js";
import { trialUsage } from "../runtime/access.js";
import { getPackage } from "../runtime/packages.js";
import { myTrial, trialLeft, trialLimits } from "../runtime/trial.js";
import { findAgentRow, getAgentDetail, getCreator, getCreatorProfile, listAgents, listCategories, listCreators, listReviews, mapAgents, submitReview } from "./catalog.js";
import { catalogLangOf } from "./lang-rules.js";
import { toLicense, toReputation } from "./mappers.js";
import { ensureProfile } from "./profile.js";
import { publicConfig } from "./public-config.js";

export const storeRouter = Router();

// ---------- Public ----------

storeRouter.get("/config", h(async () => publicConfig()));

storeRouter.get(
  "/agents",
  h(async (req, res) => {
    const q = parse(
      z.object({
        q: z.string().max(200).optional(),
        category: z.string().max(60).optional(),
        sort: z.enum(["rating", "uses", "trend", "new"]).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      req.query,
    );
    return listAgents({ ...q, lang: catalogLangOf(req, res) });
  }),
);

storeRouter.get("/categories", h(async () => listCategories()));

storeRouter.get(
  "/agents/:idOrSlug/reviews",
  h(async (req) => {
    const row = await findAgentRow(String(req.params.idOrSlug));
    return listReviews(row.id, 200);
  }),
);

storeRouter.post(
  "/agents/:idOrSlug/reviews",
  requireUser,
  h(async (req) => {
    const userId = requireUserId(req);
    const body = parse(z.object({ rating: z.number().int().min(1).max(5), text: z.string().max(2000).default("") }), req.body);
    return submitReview(userId, String(req.params.idOrSlug), body);
  }),
);

storeRouter.get("/agents/:idOrSlug", h(async (req, res) => getAgentDetail(String(req.params.idOrSlug), catalogLangOf(req, res))));

storeRouter.post(
  "/search",
  h(async (req, res) => {
    const { need } = parse(z.object({ need: z.string().min(3).max(500) }), req.body);
    return mapAgents(await searchAgentRows(need, 3), catalogLangOf(req, res));
  }),
);

storeRouter.get("/creators", h(async (req, res) => listCreators(catalogLangOf(req, res))));

storeRouter.get("/creators/:id", h(async (req, res) => getCreatorProfile(String(req.params.id), catalogLangOf(req, res))));

// ---------- Authenticated ----------

storeRouter.get(
  "/me/licenses",
  requireUser,
  h(async (req): Promise<License[]> => {
    const userId = requireUserId(req);
    const lic = await db
      .select()
      .from(schema.licenses)
      .where(eq(schema.licenses.userId, userId))
      .orderBy(desc(schema.licenses.acquiredAt));
    return lic.map(toLicense);
  }),
);

storeRouter.get(
  "/me/reputation",
  requireUser,
  h(async (req) => {
    const userId = requireUserId(req);
    const [row] = await db.select().from(schema.userReputation).where(eq(schema.userReputation.userId, userId));
    return toReputation(userId, row);
  }),
);

/** Purchase history of the profile: the user's paid charges (newest first). */
const HISTORY_LIMIT = 30;

storeRouter.get(
  "/me/profile",
  requireUser,
  h(async (req, res): Promise<Profile> => {
    const userId = requireUserId(req);
    const lang = catalogLangOf(req, res);
    const [rep] = await db.select().from(schema.userReputation).where(eq(schema.userReputation.userId, userId));
    const [creatorRow] = await db.select().from(schema.creators).where(eq(schema.creators.userId, userId));
    const [user] = await db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId));
    const profile = await ensureProfile(userId);
    const paid = await db
      .select({ kind: schema.paymentLedger.kind, agentName: schema.agents.name, at: schema.paymentLedger.fulfilledAt })
      .from(schema.paymentLedger)
      .innerJoin(schema.agents, eq(schema.agents.id, schema.paymentLedger.agentId))
      .where(and(eq(schema.paymentLedger.buyerUserId, userId), eq(schema.paymentLedger.status, "fulfilled")))
      .orderBy(desc(schema.paymentLedger.fulfilledAt))
      .limit(HISTORY_LIMIT);
    return {
      userId,
      displayName: profile.displayName,
      email: user?.email ?? profile.email ?? "",
      memberSince: profile.createdAt.toISOString(),
      reputation: toReputation(userId, rep),
      creator: creatorRow ? await getCreator(creatorRow.id, lang) : null,
      history: paid.map((p) => ({ kind: p.kind, label: `License purchase: ${p.agentName}`, at: (p.at ?? new Date()).toISOString() })),
    };
  }),
);

/** Profile name and e-mail (the web sends the data of the e-mail login). */
storeRouter.patch(
  "/me/profile",
  requireUser,
  h(async (req) => {
    const userId = requireUserId(req);
    const body = parse(
      z.object({
        displayName: z.string().trim().min(1).max(80).nullable().optional(),
        email: z.string().trim().toLowerCase().email().max(200).nullable().optional(),
      }),
      req.body,
    );
    await ensureProfile(userId);
    await db
      .update(schema.userProfiles)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(schema.userProfiles.userId, userId));
    return { ok: true };
  }),
);

/** Usage of each Solver by the user (library): totals, current month and 8 weeks. */
storeRouter.get(
  "/me/usage",
  requireUser,
  h(async (req): Promise<UsageSummary[]> => {
    const userId = requireUserId(req);
    const act = sql`${schema.usageEvents.tool} = 'activate_solver'`;
    const rows = await db
      .select({
        agentId: schema.usageEvents.agentId,
        activations: sql<number>`count(*) filter (where ${act})`.mapWith(Number),
        calls: sql<number>`count(*)`.mapWith(Number),
        lastUsedAt: sql<string>`max(${schema.usageEvents.createdAt})`,
        usesThisMonth: sql<number>`count(*) filter (where ${act} and ${schema.usageEvents.createdAt} >= date_trunc('month', now()))`.mapWith(Number),
      })
      .from(schema.usageEvents)
      .where(eq(schema.usageEvents.userId, userId))
      .groupBy(schema.usageEvents.agentId);
    // Activations per week (0 = current week ... 7 = seven weeks ago).
    const weeks = await db
      .select({
        agentId: schema.usageEvents.agentId,
        ago: sql<number>`((date_trunc('week', now())::date - date_trunc('week', ${schema.usageEvents.createdAt})::date) / 7)`.mapWith(Number),
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(schema.usageEvents)
      .where(and(eq(schema.usageEvents.userId, userId), act, gt(schema.usageEvents.createdAt, sql`date_trunc('week', now()) - interval '7 weeks'`)))
      .groupBy(sql`1`, sql`2`);
    const weekly = (agentId: string) => {
      const out = [0, 0, 0, 0, 0, 0, 0, 0];
      for (const w of weeks) if (w.agentId === agentId && w.ago >= 0 && w.ago < 8) out[7 - w.ago] = w.n;
      return out;
    };
    return rows.flatMap((r) =>
      r.agentId
        ? [
            {
              agentId: r.agentId,
              activations: r.activations,
              calls: r.calls,
              lastUsedAt: new Date(r.lastUsedAt).toISOString(),
              usesThisMonth: r.usesThisMonth,
              weekly: weekly(r.agentId),
            },
          ]
        : [],
    );
  }),
);

/** How the user accesses a Solver right now (license or the free trial's balance). */
storeRouter.get(
  "/me/access/:idOrSlug",
  requireUser,
  h(async (req): Promise<AgentAccess> => {
    const userId = requireUserId(req);
    const row = await findAgentRow(String(req.params.idOrSlug));
    const [lic] = await db
      .select()
      .from(schema.licenses)
      .where(and(eq(schema.licenses.userId, userId), eq(schema.licenses.agentId, row.id)));
    const pkg = getPackage(row.id);
    const limits = pkg ? trialLimits(pkg.manifest) : null;
    if (!limits) return { agentId: row.id, license: lic ? lic.id : null, trialUsesLeft: 0, trial: null };
    const { used, usage } = await trialUsage(userId, row.id);
    return {
      agentId: row.id,
      license: lic ? lic.id : null,
      trialUsesLeft: Math.max(0, limits.uses - used),
      trial: trialLeft(limits, usage),
    };
  }),
);

/** The user's free trials in progress (library): only Solvers already activated and still without a license. */
storeRouter.get(
  "/me/trials",
  requireUser,
  h(async (req): Promise<MyTrial[]> => {
    const userId = requireUserId(req);
    const rows = await db.select().from(schema.trials).where(eq(schema.trials.userId, userId)).orderBy(desc(schema.trials.updatedAt));
    if (!rows.length) return [];
    const owned = await db
      .select({ agentId: schema.licenses.agentId })
      .from(schema.licenses)
      .where(eq(schema.licenses.userId, userId));
    const licensed = new Set(owned.map((l) => l.agentId));
    return rows.flatMap((r) => {
      const pkg = getPackage(r.agentId);
      const limits = pkg ? trialLimits(pkg.manifest) : null;
      if (!limits || licensed.has(r.agentId) || r.used <= 0) return [];
      return [myTrial(r.agentId, limits, r.used, { searchesUsed: r.searchesUsed, toolRuns: r.toolRuns }, r.updatedAt)];
    });
  }),
);
