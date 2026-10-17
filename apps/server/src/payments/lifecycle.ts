import type { ChargeStatus } from "./types.js";

// Charge lifecycle (plan §6.4). Pure: no env or database, tested in test/payments-rules.test.ts.
//
//   created -> pending_payment -> confirmed -> fulfilled
//                     |
//                     v
//              expired / failed
//
// A paid Checkout Session is a fact that cannot be undone, so it fulfils any open or abandoned charge in one
// transaction (PAID_FULFILS) instead of walking the normal order. `fulfilling`, `refunding` and `refunded` stay in the
// schema for refunds handled by hand.

const NEXT: Readonly<Record<ChargeStatus, readonly ChargeStatus[]>> = {
  created: ["pending_payment", "confirmed", "failed", "expired"],
  pending_payment: ["confirmed", "expired", "failed"],
  confirmed: ["fulfilling", "fulfilled", "refunding"],
  fulfilling: ["fulfilled", "confirmed", "refunding", "failed"],
  fulfilled: [],
  refunding: ["refunded"],
  refunded: [],
  expired: ["confirmed"],
  failed: [],
};

export function canTransition(from: ChargeStatus, to: ChargeStatus): boolean {
  return NEXT[from].includes(to);
}

/** Statuses from which `to` is reachable (used as the WHERE clause of conditional updates). */
export function sourcesOf(to: ChargeStatus): ChargeStatus[] {
  return (Object.keys(NEXT) as ChargeStatus[]).filter((from) => NEXT[from].includes(to));
}

/** Statuses a proven payment fulfils directly (everything still open or abandoned). A refunded charge needs a human. */
export const PAID_FULFILS: readonly ChargeStatus[] = ["created", "pending_payment", "confirmed", "fulfilling", "expired", "failed"];

/** Statuses the reconcile job still has to move. */
export const OPEN_STATUSES: readonly ChargeStatus[] = ["created", "pending_payment", "confirmed", "fulfilling"];

export const TERMINAL_STATUSES: readonly ChargeStatus[] = ["fulfilled", "refunded", "expired", "failed"];
