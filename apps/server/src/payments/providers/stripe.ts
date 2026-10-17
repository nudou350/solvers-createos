import type Stripe from "stripe";

import { env } from "../../env.js";
import { alertAdmin } from "../alerts.js";
import { loadCharge, patchCharge, payloadOf, transition, type LedgerRow } from "../ledger.js";
import { PlatformProvider, type PaymentState, type StartedPayment } from "../platform-provider.js";
import { stripe } from "../stripe-client.js";
import { checkoutSessionParams, ledgerIdOf, sessionMismatch, type CheckoutOutcome } from "../stripe-rules.js";
import type { ChargeContext, ChargeIntent } from "../types.js";

// Hosted Stripe Checkout (plan §6.4, test mode): the ledger row is written first, then a Checkout Session whose
// idempotency key is the ledger id, so a retried create never opens a second session. The `checkout.session.*` webhooks
// (stripe-routes.ts) settle the charge; the reconcile job asks the API about sessions still open after an hour.

/** Unpaid sessions are left to the webhook for this long before the reconcile job asks the API. */
export const RECONCILE_AFTER_MS = 60 * 60_000;

export class StripeProvider extends PlatformProvider {
  readonly id = "stripe" as const;

  protected override reconcileAfterMs(): number {
    return RECONCILE_AFTER_MS;
  }

  protected async startPayment(row: LedgerRow, intent: ChargeIntent, ctx: ChargeContext): Promise<StartedPayment> {
    if (!ctx.agent) throw new Error("stripe: the checkout needs the agent's slug and name");
    const session = await stripe().checkout.sessions.create(
      checkoutSessionParams({
        ledgerId: row.id,
        userId: intent.userId,
        customerEmail: ctx.customerEmail ?? null,
        agent: { id: intent.agentId, slug: ctx.agent.slug, name: ctx.agent.name },
        amountCents: intent.amountCents,
        webUrl: env.PUBLIC_WEB_URL,
      }),
      { idempotencyKey: row.id },
    );
    if (!session.url) throw new Error(`stripe: Checkout Session ${session.id} has no url`);
    // webUrl: the session returns the buyer there, so only a server with the same web origin may hand it out again.
    return { providerRef: session.id, payload: { checkoutUrl: session.url, webUrl: env.PUBLIC_WEB_URL } };
  }

  protected override paymentView(row: LedgerRow): Record<string, unknown> | null {
    const url = payloadOf(row).checkoutUrl;
    return typeof url === "string" ? { url } : null;
  }

  protected async paymentState(row: LedgerRow): Promise<PaymentState> {
    // No session id after the reconcile delay: the create failed half-way and nobody ever got a URL to pay.
    if (!row.providerRef) return "failed";
    const s = await stripe().checkout.sessions.retrieve(row.providerRef);
    if (s.status === "complete" && s.payment_status === "paid") return "paid";
    if (s.status === "expired") return "expired";
    return "pending";
  }

  /** Applies a verified `checkout.session.*` event to its charge (idempotent). */
  async settleSession(outcome: CheckoutOutcome, session: Stripe.Checkout.Session): Promise<LedgerRow | null> {
    const ledgerId = ledgerIdOf(session);
    const row = ledgerId ? await loadCharge(ledgerId) : undefined;
    if (!row || row.provider !== this.id) {
      // Another environment sharing the Stripe account (e.g. `stripe listen` on a laptop): not ours, nothing to retry.
      console.warn(`[payments] stripe: ${session.id} has no charge here (ledgerId ${ledgerId ?? "none"}); ignored`);
      return null;
    }
    if (outcome === "expired") return transition(row.id, ["created", "pending_payment"], "expired");
    if (outcome === "failed") return transition(row.id, ["created", "pending_payment"], "failed", { error: "async_payment_failed" });

    const mismatch = sessionMismatch(
      { amountCents: row.amountCents, currency: row.currency, userId: row.buyerUserId, agentId: row.agentId, providerRef: row.providerRef },
      session,
    );
    if (mismatch) {
      await alertAdmin(`stripe-mismatch:${row.id}`, `charge ${row.id}: paid session ${session.id} does not match the ledger (${mismatch}). Check it manually.`);
      return patchCharge(row.id, { error: `session mismatch: ${mismatch}`.slice(0, 500) });
    }
    const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
    return this.settlePaid(row, session.id, paymentIntent ? { paymentIntent } : undefined);
  }
}
