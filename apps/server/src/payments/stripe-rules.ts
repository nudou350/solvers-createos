import Stripe from "stripe";

import { HttpError } from "../lib/http.js";

// Pure rules of the Stripe Checkout flow (plan §6.4): prices and the fee split in integer cents, the Checkout Session
// parameters, webhook verification and the idempotent event dispatch. No env, database or network; tested in
// test/stripe.test.ts.

/** Lowest price a Solver can be sold for: US$ 5. */
export const MIN_PRICE_CENTS = 500;
/** Platform fee on every sale (10%); the rest is the creator's share, paid out later through Connect. */
export const PLATFORM_FEE_BPS = 1_000;
const BPS = 10_000;

/** `fee = floor(amount × bps / 10_000)`, `creator = amount − fee`. Integer cents only. */
export function feeSplit(amountCents: number, feeBps = PLATFORM_FEE_BPS): { feeCents: number; creatorCents: number } {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new RangeError(`amountCents must be a non-negative integer, got ${amountCents}`);
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > BPS) throw new RangeError(`feeBps must be an integer in [0, ${BPS}], got ${feeBps}`);
  const feeCents = Math.floor((amountCents * feeBps) / BPS);
  return { feeCents, creatorCents: amountCents - feeCents };
}

/** Why this user cannot open a checkout for this Solver (null = allowed). */
export function checkoutBlock(input: {
  userId: string;
  creatorUserId: string | null;
  ownedLicenseId: string | null;
  priceCents: number;
}): HttpError | null {
  if (input.ownedLicenseId) {
    return new HttpError(409, "You already have this specialist's license.", "already_owned", { licenseId: input.ownedLicenseId });
  }
  if (input.creatorUserId && input.creatorUserId === input.userId) {
    return new HttpError(400, "The specialist's creator can't buy their own license.", "creator_cannot_buy");
  }
  if (!Number.isSafeInteger(input.priceCents) || input.priceCents < MIN_PRICE_CENTS) {
    return new HttpError(409, "This specialist's price is below the US$ 5 minimum, so it can't be bought right now.", "below_min_price", {
      minPriceCents: MIN_PRICE_CENTS,
    });
  }
  return null;
}

export type CheckoutInput = {
  ledgerId: string;
  userId: string;
  customerEmail: string | null;
  agent: { id: string; slug: string; name: string };
  amountCents: number;
  /** PUBLIC_WEB_URL (no trailing slash needed). */
  webUrl: string;
};

/** Hosted Checkout Session for one license (one-time payment in USD cents). */
export function checkoutSessionParams(i: CheckoutInput): Stripe.Checkout.SessionCreateParams {
  const web = i.webUrl.replace(/\/+$/, "");
  const slug = encodeURIComponent(i.agent.slug);
  return {
    mode: "payment",
    line_items: [{ price_data: { currency: "usd", unit_amount: i.amountCents, product_data: { name: i.agent.name } }, quantity: 1 }],
    ...(i.customerEmail ? { customer_email: i.customerEmail } : {}),
    client_reference_id: i.ledgerId,
    metadata: { ledgerId: i.ledgerId, agentId: i.agent.id, userId: i.userId },
    payment_intent_data: { metadata: { ledgerId: i.ledgerId, agentId: i.agent.id, userId: i.userId } },
    success_url: `${web}/library?bought=${slug}`,
    cancel_url: `${web}/solvers/${slug}`,
  };
}

/** Verifies the `Stripe-Signature` header over the raw body and parses the event (throws on a bad signature). */
export function verifyStripeEvent(rawBody: Buffer | string, signature: string | string[] | undefined, secret: string): Stripe.Event {
  if (!signature) throw new Error("missing Stripe-Signature header");
  return Stripe.webhooks.constructEvent(rawBody, signature, secret);
}

/** The ledger id a Checkout Session was opened for. */
export function ledgerIdOf(session: Stripe.Checkout.Session): string | null {
  return session.metadata?.ledgerId || session.client_reference_id || null;
}

export type CheckoutOutcome = "paid" | "failed" | "expired";

/** What a Checkout event means for its charge; null for events we do not act on (e.g. a completed but unpaid session). */
export function checkoutOutcome(event: Stripe.Event): { outcome: CheckoutOutcome; session: Stripe.Checkout.Session } | null {
  switch (event.type) {
    case "checkout.session.completed":
      // Delayed methods complete the session before the money arrives; `async_payment_succeeded` follows.
      return event.data.object.payment_status === "paid" ? { outcome: "paid", session: event.data.object } : null;
    case "checkout.session.async_payment_succeeded":
      return { outcome: "paid", session: event.data.object };
    case "checkout.session.async_payment_failed":
      return { outcome: "failed", session: event.data.object };
    case "checkout.session.expired":
      return { outcome: "expired", session: event.data.object };
    default:
      return null;
  }
}

/** Every event type the webhook endpoint must be subscribed to. */
export const CHECKOUT_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
] as const;

/** Paid Checkout Session vs. the ledger row it claims to pay: a reason when they disagree, null when they match. */
export function sessionMismatch(
  row: { amountCents: number; currency: string; userId: string; agentId: string; providerRef: string | null },
  session: Pick<Stripe.Checkout.Session, "id" | "amount_total" | "currency" | "metadata">,
): string | null {
  if (row.providerRef && row.providerRef !== session.id) return `session ${session.id} is not the charge's session ${row.providerRef}`;
  if (session.amount_total !== row.amountCents) return `amount ${session.amount_total} != ${row.amountCents}`;
  if ((session.currency ?? "").toLowerCase() !== row.currency.toLowerCase()) return `currency ${session.currency} != ${row.currency}`;
  if (session.metadata?.userId && session.metadata.userId !== row.userId) return "user mismatch";
  if (session.metadata?.agentId && session.metadata.agentId !== row.agentId) return "agent mismatch";
  return null;
}

/** Where processed event ids live (`stripe_events`); Stripe delivers at least once and may deliver concurrently. */
export type EventLog = {
  /** Records the event if new; returns false when it was already processed (a redelivery). */
  begin(id: string, type: string): Promise<boolean>;
  /** Marks the event processed (only after its effects are committed). */
  done(id: string): Promise<void>;
};

export type CheckoutHandler = (outcome: CheckoutOutcome, session: Stripe.Checkout.Session) => Promise<unknown>;

/**
 * Applies an event at most once: a redelivery of a processed event is a no-op; an event whose handling failed (never
 * marked done) is handled again on the retry. The handler itself is idempotent (conditional ledger updates, unique
 * license per Checkout Session), so two concurrent first deliveries are harmless.
 */
export async function processStripeEvent(event: Stripe.Event, log: EventLog, handle: CheckoutHandler): Promise<"duplicate" | "handled" | "ignored"> {
  if (!(await log.begin(event.id, event.type))) return "duplicate";
  const c = checkoutOutcome(event);
  if (c) await handle(c.outcome, c.session);
  await log.done(event.id);
  return c ? "handled" : "ignored";
}
