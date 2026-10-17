import { z } from "zod";

// Core data contract shared by server, api-client and web. Field names are part of the API: the web uses the same
// names. Prices are integer USD cents (money.ts); people are identified by `users.id` (uuid).

export const Requirement = z.object({
  type: z.enum(["client", "connector", "plan"]),
  label: z.string(),
  key: z.string().optional(),
  /** Optional: when missing, the preflight warns without blocking (e.g. Figma with a path that needs no connector). */
  optional: z.boolean().optional(),
  /** Connector: how to connect, in 1-3 sentences (the creator writes it for connectors outside the catalog). */
  howTo: z.string().max(600).optional(),
  /** Connector: official help link, the fallback when the AI client's menu changes. */
  helpUrl: z.string().url().optional(),
});

/** Agent status names. */
export const AgentStatus = z.enum(["pending", "active", "suspended", "retired"]);

export const Agent = z.object({
  /** Package id: 32 hex characters (manifest `id`). */
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
  category: z.string(),
  creatorId: z.string(),
  version: z.string(),
  versionHash: z.string(),
  /** Lifetime license price, in cents. */
  priceCents: z.number().int().nonnegative(),
  /** Has a free trial (limits in AgentDetail.trial). */
  trialAvailable: z.boolean(),
  userRating: z.number(),
  reviewsCount: z.number(),
  verifiedUses: z.number(),
  evalScore: z.number(),
  requirements: z.array(Requirement),
  packageContents: z.array(z.string()),
  /** Platform Solver (e.g. the Solver creator): free, no license or purchase, DB only. */
  platform: z.boolean().default(false),
  /** Proven differentiators (PACKAGE_SPEC.md 4.2): tool, verifier, liveData, memory, escalation. Empty for v0 packages. */
  differentiators: z.array(z.string()).default([]),
  trend7d: z.number(),
  /** Date of the first published version (ISO). */
  publishedAt: z.string(),
});

export const Creator = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string(),
  reputationScore: z.number(),
  disputesLost: z.number(),
  agentsPublished: z.number(),
});

export const License = z.object({
  /** License id (uuid). */
  id: z.string(),
  agentId: z.string(),
  /** Owner (`users.id`). */
  userId: z.string(),
  acquiredAt: z.string(),
  /** Only lifetime licenses exist. */
  type: z.literal("permanent"),
});

/** Image hosted on the CDN: `url` is the large version, `thumbUrl` the thumbnail. */
export const ImageRef = z.object({
  id: z.string(),
  url: z.string(),
  thumbUrl: z.string(),
  width: z.number().int(),
  height: z.number().int(),
});

export const Review = z.object({
  id: z.string(),
  agentId: z.string(),
  authorUserId: z.string(),
  rating: z.number().int().min(1).max(5),
  text: z.string(),
  createdAt: z.string(),
  verifiedPurchase: z.literal(true),
  /** Reviewer's profile name (null: the storefront shows a generic "Verified buyer"). */
  authorName: z.string().nullable(),
  /** Photos the buyer attached (up to MAX_REVIEW_IMAGES). */
  images: z.array(ImageRef).default([]),
});

/** Note in the Solver's memory (saved at the user's request). */
export const MemoryNote = z.object({ id: z.string(), text: z.string(), at: z.string() });

/** Solver memory: encrypted on the server. `summary` may be empty; profile and notes are optional (PACKAGE_SPEC.md 11). */
export const Memory = z.object({
  id: z.string(),
  agentId: z.string(),
  summary: z.string(),
  /** Calibration answers (or { skipped: true }). */
  profile: z.record(z.unknown()).nullable().default(null),
  notes: z.array(MemoryNote).default([]),
  updatedAt: z.string(),
});

export const UserReputation = z.object({
  userId: z.string(),
  score: z.number(),
  purchases: z.number(),
  disputesLost: z.number(),
});

export type Requirement = z.infer<typeof Requirement>;
export type AgentStatus = z.infer<typeof AgentStatus>;
export type Agent = z.infer<typeof Agent>;
export type Creator = z.infer<typeof Creator>;
export type License = z.infer<typeof License>;
export type ImageRef = z.infer<typeof ImageRef>;
export type Review = z.infer<typeof Review>;
export type Memory = z.infer<typeof Memory>;
export type UserReputation = z.infer<typeof UserReputation>;
