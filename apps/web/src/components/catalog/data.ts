// Catalog types and helpers (home, Solver and creator pages).
// Formatting, reputation badge and durations in lib/format; --gap in lib/style.
import type { Creator } from "@solvers/api-client";

/** Short creator for the cards: name and reputation (from getCreators()). */
export type CreatorMini = { name: string; reputationScore: number };
export type CreatorMap = Record<string, CreatorMini>;

export function creatorMap(list: Creator[]): CreatorMap {
  return Object.fromEntries(list.map((c) => [c.id, { name: c.name, reputationScore: c.reputationScore }]));
}

export const agentHref = (slug: string) => `/solvers/${encodeURIComponent(slug)}`;
export const creatorHref = (id: string) => `/creators/${encodeURIComponent(id)}`;
