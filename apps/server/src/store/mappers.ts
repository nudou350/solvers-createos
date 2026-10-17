import type { Agent, CatalogLang, Creator, ImageRef, License, Review, UserReputation } from "@solvers/shared";
import { averageRating, bpsToScore, creatorReputationScore, overlayCatalogTexts, reputationScore } from "@solvers/shared";
import type { schema } from "../db/index.js";
import { provenDifferentiators } from "../runtime/differentiators.js";
import { isPlatformAgentRow } from "../runtime/platform-agents.js";
import { getPackage } from "../runtime/packages.js";
import { trialLimits } from "../runtime/trial.js";

type AgentRow = typeof schema.agents.$inferSelect;
type CreatorRow = typeof schema.creators.$inferSelect;
type LicenseRow = typeof schema.licenses.$inferSelect;
type ReviewRow = typeof schema.reviews.$inferSelect;
type RepRow = typeof schema.userReputation.$inferSelect;

export type AgentExtras = { trend7d: number };

/** Date of the first known version (manifest), or of the database row. */
export function publishedAt(row: AgentRow): string {
  const dates = (row.details.versions ?? []).map((v) => Date.parse(v.releasedAt)).filter((t) => !Number.isNaN(t));
  return new Date(dates.length ? Math.min(...dates) : row.createdAt.getTime()).toISOString();
}

export function hasTrial(agentId: string): boolean {
  const pkg = getPackage(agentId);
  return !!pkg && trialLimits(pkg.manifest) !== null;
}

/**
 * Eval score shown for the CURRENT version only (D6): an eval measured for another version hash reads as "not measured"
 * (0).
 */
export function currentEvalBps(row: Pick<AgentRow, "evalScoreBps" | "evalVersionHash" | "versionHash">): number {
  // No measured version on record = not measured (D6): never show a score of unknown provenance.
  if (!row.evalVersionHash) return 0;
  return row.evalVersionHash.toLowerCase() === row.versionHash.toLowerCase() ? row.evalScoreBps : 0;
}

/** `lang` pt overlays the translated catalog texts (`agents.translations`); en (default) is the manifest's. */
export function toAgent(row: AgentRow, extras: AgentExtras, lang: CatalogLang = "en"): Agent {
  const texts = overlayCatalogTexts(
    { name: row.name, tagline: row.tagline, description: row.description, packageContents: row.packageContents, requirements: row.requirements },
    row.translations,
    lang,
  );
  return {
    id: row.id,
    slug: row.slug,
    name: texts.name,
    tagline: texts.tagline,
    description: texts.description,
    category: row.category,
    creatorId: row.creatorId,
    version: row.version,
    versionHash: row.versionHash,
    priceCents: row.priceCents,
    // The free trial comes from the manifest on disk, the same source the connector uses to enforce its limits.
    trialAvailable: hasTrial(row.id),
    userRating: averageRating(row.ratingSum, row.ratingCount),
    reviewsCount: row.ratingCount,
    verifiedUses: Number(row.verifiedUses),
    evalScore: bpsToScore(currentEvalBps(row)),
    requirements: texts.requirements,
    packageContents: texts.packageContents,
    // Platform Solver (free, database only): the server's PLATFORM_AGENTS list decides, not the manifest. The storefront
    // hides price and purchase by this field. Differentiators: only those proven by the validator (v1 packages); v0 = [].
    platform: isPlatformAgentRow(row),
    differentiators: provenDifferentiators(getPackage(row.id)),
    trend7d: extras.trend7d,
    publishedAt: publishedAt(row),
  };
}

export type CreatorStats = { totalSales: number; avgRating: number; agentsPublished: number };

/** `bio`: the bio already in the requested language (catalog.ts picks the translated one); defaults to the stored bio. */
export function toCreator(row: CreatorRow, stats: CreatorStats, bio: string = row.bio): Creator {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatarUrl,
    bio,
    reputationScore: creatorReputationScore(stats.totalSales, stats.avgRating, 0),
    disputesLost: 0,
    agentsPublished: stats.agentsPublished,
  };
}

export function toLicense(row: LicenseRow): License {
  return {
    id: row.id,
    agentId: row.agentId,
    userId: row.userId,
    acquiredAt: row.acquiredAt.toISOString(),
    type: "permanent",
  };
}

export function toReview(row: ReviewRow, authorName: string | null = null, images: ImageRef[] = []): Review {
  return {
    id: row.id,
    agentId: row.agentId,
    authorUserId: row.authorUserId,
    rating: row.rating,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    verifiedPurchase: true,
    authorName,
    images,
  };
}

export function toReputation(userId: string, row: RepRow | undefined): UserReputation {
  const purchases = row?.purchases ?? 0;
  return { userId, score: reputationScore(purchases, 0), purchases, disputesLost: 0 };
}
