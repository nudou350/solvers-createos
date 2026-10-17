// Pure helpers of the account screens (library, profile). No React.

/** Slug from `?bought=<slug>` (the page Stripe returns to after paying); null when missing or not a slug. */
export function boughtSlug(value: string | null | undefined): string | null {
  const s = value?.trim().toLowerCase();
  return s && /^[a-z0-9][a-z0-9-]{0,79}$/.test(s) ? s : null;
}

/** Banner after a purchase: "done" once the Solver is in the library, "confirming" while the payment is being recorded. */
export type BoughtState = "done" | "confirming";

/**
 * The Stripe webhook may land a few seconds after the buyer is back, so the bought Solver may not be in the library
 * yet. `ownedSlugs` are the slugs of the Solvers the person owns.
 */
export function boughtState(slug: string, ownedSlugs: Iterable<string>): BoughtState {
  for (const s of ownedSlugs) if (s.toLowerCase() === slug) return "done";
  return "confirming";
}

/** How many times (and how often) the library re-reads the list while the purchase is confirming. */
export const BOUGHT_POLL = { attempts: 6, intervalMs: 2500 } as const;
