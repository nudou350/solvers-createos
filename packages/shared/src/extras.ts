import { z } from "zod";
import { MAX_BPS } from "./money.js";
import { Agent, AgentStatus, Creator, ImageRef, Review, UserReputation } from "./schemas.js";

// API response and request schemas for screens the core schemas do not cover. They never change the fields of
// Agent/Creator/...; they come as separate objects.

export const BeforeAfter = z.object({
  prompt: z.string(),
  withoutSolver: z.string(),
  withSolver: z.string(),
});

export const AgentVersion = z.object({
  version: z.string(),
  versionHash: z.string(),
  releasedAt: z.string(),
  notes: z.string(),
  /** Eval score measured for THIS version (null: not measured for it; decisions.md D6). */
  evalScore: z.number().nullable(),
});

/** Free trial of a Solver: what it unlocks, with limits enforced by the server. */
export const TrialInfo = z.object({
  /** Free activations per user. */
  uses: z.number(),
  /** Initial steps unlocked (1..steps). */
  steps: z.number(),
  totalSteps: z.number(),
  /** Knowledge-base searches (search_knowledge) for the whole trial. */
  searches: z.number(),
  /** Runs per tool for the whole trial; a tool outside the list is blocked. */
  tools: z.array(z.object({ name: z.string(), limit: z.number() })),
  /** Agreed request size during the trial (e.g. "1 component per use"). */
  scope: z.string().nullable(),
  summary: z.string(),
  lockedSummary: z.string(),
});

/** GET /api/agents/:slug */
export const AgentDetail = z.object({
  agent: Agent,
  creator: Creator,
  reviews: z.array(Review),
  /** Creator gallery (up to MAX_AGENT_IMAGES), already reviewed. */
  images: z.array(ImageRef).default([]),
  beforeAfter: z.array(BeforeAfter),
  versions: z.array(AgentVersion),
  /** null: no free trial. */
  trial: TrialInfo.nullable(),
  /** Review count per rating, from 5 down to 1 star. */
  ratingDistribution: z.array(z.number()).length(5),
});

/** GET /api/creators/:id */
export const CreatorProfile = z.object({
  creator: Creator,
  agents: z.array(Agent),
});

/** GET /api/creator/dashboard. Every money field is integer USD cents (`*Cents`). */
export const CreatorDashboard = z.object({
  creator: Creator.nullable(),
  totals: z.object({
    sales: z.number(),
    uses: z.number(),
    /** Creator share of every license sale (net of the platform fee), all time. */
    salesRevenueCents: z.number().int(),
  }),
  /** Last 30 days. */
  last30: z.object({ sales: z.number(), uses: z.number(), revenueCents: z.number().int() }),
  /** Creator share of each sale (1 - platform fee), in percent (display only). */
  creatorSharePct: z.number(),
  agents: z.array(
    z.object({
      agentId: z.string(),
      slug: z.string(),
      name: z.string(),
      category: z.string(),
      version: z.string(),
      status: AgentStatus,
      listed: z.boolean(),
      userRating: z.number(),
      evalScore: z.number(),
      sales: z.number(),
      uses: z.number(),
      revenueCents: z.number().int(),
      /** Current license price. */
      priceCents: z.number().int(),
    }),
  ),
  daily: z.array(z.object({ date: z.string(), sales: z.number(), uses: z.number(), revenueCents: z.number().int() })),
});

/** GET /api/connector */
export const ConnectorStatus = z.object({
  url: z.string(),
  authorizedClients: z.array(z.object({ clientName: z.string(), authorizedAt: z.string() })),
});

/** GET /api/me/profile */
export const Profile = z.object({
  userId: z.string(),
  displayName: z.string().nullable(),
  email: z.string(),
  memberSince: z.string(),
  reputation: UserReputation,
  creator: Creator.nullable(),
  history: z.array(z.object({ kind: z.string(), label: z.string(), at: z.string() })),
});

/** GET /api/me/usage */
export const UsageSummary = z.object({
  agentId: z.string(),
  activations: z.number(),
  calls: z.number(),
  lastUsedAt: z.string().nullable(),
  usesThisMonth: z.number(),
  /** Activations per week, last 8 weeks (the last one is the current week). */
  weekly: z.array(z.number()).length(8),
});

/** GET /api/me/access/:idOrSlug: how the user can access the Solver right now. */
export const AgentAccess = z.object({
  agentId: z.string(),
  /** License id (uuid), or null. */
  license: z.string().nullable(),
  /** 0 when the Solver has no free trial. */
  trialUsesLeft: z.number(),
  /** Balance of the whole trial (null: no free trial). */
  trial: z.object({ searchesLeft: z.number(), toolsLeft: z.record(z.number()) }).nullable(),
});

/**
 * GET /api/me/trials: the user's free trials in progress (one per Solver already activated without a license).
 * `usesLeft` 0 = trial used up.
 */
export const MyTrial = z.object({
  agentId: z.string(),
  uses: z.number(),
  usesLeft: z.number(),
  searches: z.number(),
  searchesLeft: z.number(),
  tools: z.array(z.object({ name: z.string(), limit: z.number(), left: z.number() })),
  lastUsedAt: z.string(),
});

// ----- Config (GET /api/config) -----

export const PublicConfig = z.object({
  /** Currency of every price (`"usd"`). */
  currency: z.string(),
  /** Platform fee on every sale, in bps (10% = 1000). */
  feeBps: z.number().int().min(0).max(MAX_BPS),
  /** Minimum license price, in cents. */
  minPriceCents: z.number().int().nonnegative(),
  /** Stripe publishable key (test mode); null when payments are not configured. */
  stripePublishableKey: z.string().nullable(),
  /** `DEV_LOGIN=1`: the sign-in link is printed to the server log instead of emailed. */
  devLogin: z.boolean(),
  connectorUrl: z.string(),
  freeTrialUses: z.number(),
});

// ----- Auth (email magic link) -----

/** Body of POST /api/auth/email: sends a single-use sign-in link (15 min) to the address. */
export const AuthEmailInput = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

/** Response of POST /api/auth/email. `devLink` only with `DEV_LOGIN=1` (never in production). */
export const AuthEmailResponse = z.object({ ok: z.literal(true), devLink: z.string().optional() }).passthrough();

/** GET /api/auth/me: the signed-in user (401 without a session). */
export const SessionUser = z.object({ userId: z.string(), email: z.string() }).passthrough();

export type BeforeAfter = z.infer<typeof BeforeAfter>;
export type AgentVersion = z.infer<typeof AgentVersion>;
export type AgentDetail = z.infer<typeof AgentDetail>;
export type TrialInfo = z.infer<typeof TrialInfo>;
export type AgentAccess = z.infer<typeof AgentAccess>;
export type MyTrial = z.infer<typeof MyTrial>;
export type CreatorProfile = z.infer<typeof CreatorProfile>;
export type CreatorDashboard = z.infer<typeof CreatorDashboard>;
export type ConnectorStatus = z.infer<typeof ConnectorStatus>;
export type Profile = z.infer<typeof Profile>;
export type UsageSummary = z.infer<typeof UsageSummary>;
export type PublicConfig = z.infer<typeof PublicConfig>;
export type AuthEmailInput = z.infer<typeof AuthEmailInput>;
export type AuthEmailResponse = z.infer<typeof AuthEmailResponse>;
export type SessionUser = z.infer<typeof SessionUser>;
