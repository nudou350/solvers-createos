import { z } from "zod";

// What crosses the API for a purchase (Stripe Checkout, integer USD cents). The provider interface, the ledger and the
// webhook live in apps/server/src/payments (types.ts); this file only mirrors the response shapes the clients parse.

export const CHARGE_STATUSES = [
  "created",
  "pending_payment",
  "confirmed",
  "fulfilling",
  "fulfilled",
  "refunding",
  "refunded",
  "expired",
  "failed",
] as const;
export const ChargeStatus = z.enum(CHARGE_STATUSES);
export type ChargeStatus = z.infer<typeof ChargeStatus>;

/** GET /api/purchases/:chargeId (only the buyer sees it): dates as ISO strings. */
export const ChargeView = z
  .object({
    id: z.string(),
    provider: z.string(),
    status: ChargeStatus,
    kind: z.literal("license"),
    agentId: z.string(),
    amountCents: z.number().int().nonnegative(),
    currency: z.string(),
    error: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    fulfilledAt: z.string().nullable(),
  })
  .passthrough();
export type ChargeView = z.infer<typeof ChargeView>;

/** Body of POST /api/checkout (needs a session). */
export const CheckoutInput = z.object({ agentSlug: z.string().trim().min(1).max(100) });
export type CheckoutInput = z.infer<typeof CheckoutInput>;

/** Response of POST /api/checkout: the web redirects to the hosted Checkout page. 409 `already_owned` when licensed. */
export const CheckoutResponse = z.object({ url: z.string().url() }).passthrough();
export type CheckoutResponse = z.infer<typeof CheckoutResponse>;
