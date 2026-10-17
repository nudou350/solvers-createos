// Pure business rules shared by server and web: scores, reputation, storefront limits. Money helpers live in money.ts.

/** Free-trial activations when the manifest does not set `trial.uses`. */
export const FREE_TRIAL_USES = 3;

/** Creator gallery (like store screenshots) and photos per review. */
export const MAX_AGENT_IMAGES = 5;
export const MAX_REVIEW_IMAGES = 3;
/** Maximum size of each uploaded image (the server re-encodes it to a much smaller WebP). */
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

export function bpsToScore(bps: number): number {
  return Math.round(bps) / 100;
}

export function scoreToBps(score: number): number {
  return Math.round(score * 100);
}

export function averageRating(ratingSum: number | bigint, ratingCount: number): number {
  if (!ratingCount) return 0;
  return Math.round((Number(ratingSum) / ratingCount) * 10) / 10;
}

export function reputationScore(purchases: number, disputesLost: number): number {
  const raw = 50 + Math.min(purchases, 20) * 1.5 - disputesLost * 15;
  return Math.max(0, Math.min(100, raw));
}

/**
 * Creator reputation (0..100): grows with sales and a good rating, drops sharply with lost disputes.
 * Same idea as the buyer reputation.
 */
export function creatorReputationScore(totalSales: number, avgRating: number, disputesLost: number): number {
  const ratingBonus = avgRating > 0 ? (avgRating - 3) * 5 : 0;
  const raw = 50 + Math.min(totalSales, 20) * 1.5 + ratingBonus - disputesLost * 15;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

/** A Solver leaves the storefront with a rating below DELIST_MAX_RATING after DELIST_MIN_REVIEWS reviews. */
export const DELIST_MIN_REVIEWS = 10;
export const DELIST_MAX_RATING = 3.5;
