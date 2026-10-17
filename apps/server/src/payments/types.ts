// Payment provider types (plan §6.4). Every charge buys exactly one license of one Solver for one user, priced in
// integer USD cents; the ledger row (`payment_ledger`) is written before the provider is called.

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
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

export const PAYMENT_PROVIDER_IDS = [
  /** Hosted Stripe Checkout (one-time payment) confirmed by the `checkout.session.*` webhooks. */
  "stripe",
  /** In-memory provider for tests. */
  "fake",
] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDER_IDS)[number];

export type ChargeKind = "license";

/** What the user wants to buy: one license of `agentId` at `amountCents`. */
export type ChargeIntent = { kind: ChargeKind; agentId: string; userId: string; amountCents: number; currency: "usd" };

/** Request context the provider may need. */
export type ChargeContext = {
  now: Date;
  ip?: string | null;
  /** Prefills the hosted checkout. */
  customerEmail?: string | null;
  /** Catalog data shown on the hosted checkout and used for the return URLs. */
  agent?: { slug: string; name: string };
};

/** Server-side view of a charge (one `payment_ledger` row). */
export type Charge = {
  id: string;
  provider: PaymentProviderId;
  /** Provider's own id (Stripe Checkout Session id). */
  providerRef: string | null;
  kind: ChargeKind;
  agentId: string;
  userId: string;
  status: ChargeStatus;
  amountCents: number;
  currency: string;
  /** Platform fee and creator share, recorded when the charge is fulfilled (payouts come later with Connect). */
  feeCents: number | null;
  creatorCents: number | null;
  error: string | null;
  /** Provider-facing data for the client (e.g. the hosted checkout URL). */
  payment: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt: Date | null;
  fulfilledAt: Date | null;
};

/** Raw webhook request handed to `handleWebhook` (the provider verifies the signature itself). */
export type WebhookRequest = {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | undefined>;
  body: string;
};

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  /** Writes the ledger row first, then opens the payment at the provider. */
  createCharge(intent: ChargeIntent, ctx: ChargeContext): Promise<Charge>;
  /** Re-reads the payment at the provider; idempotent. */
  confirm(chargeId: string): Promise<Charge>;
  /** Verifies the signature, then settles the charge. null when the request is not for us. */
  handleWebhook?(raw: WebhookRequest): Promise<{ chargeId: string } | null>;
  /** confirmed -> fulfilled: one transaction that also grants the license. */
  fulfill(chargeId: string): Promise<Charge>;
  /** Settles charges whose notification was lost (expired, paid, or paid but not fulfilled). */
  reconcile(now: Date): Promise<{ advanced: number }>;
}

/** API view of a charge (GET /api/purchases/:chargeId): dates as ISO strings. */
export type ChargeView = {
  id: string;
  provider: PaymentProviderId;
  status: ChargeStatus;
  kind: ChargeKind;
  agentId: string;
  amountCents: number;
  currency: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  fulfilledAt: string | null;
};

export function toChargeView(c: Charge): ChargeView {
  return {
    id: c.id,
    provider: c.provider,
    status: c.status,
    kind: c.kind,
    agentId: c.agentId,
    amountCents: c.amountCents,
    currency: c.currency,
    error: c.error,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    fulfilledAt: c.fulfilledAt?.toISOString() ?? null,
  };
}
