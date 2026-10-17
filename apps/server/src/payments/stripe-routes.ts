import { Router, type RequestHandler } from "express";
import { and, desc, eq, gt } from "drizzle-orm";
import type Stripe from "stripe";
import { z } from "zod";

import { requireUser } from "../auth/middleware.js";
import { db, schema } from "../db/index.js";
import { env } from "../env.js";
import { h, parse, unauthorized } from "../lib/http.js";
import { initPayments, stripeProvider } from "./index.js";
import { prepareCheckout } from "./intent.js";
import { payloadOf } from "./ledger.js";
import { paymentsRouter } from "./routes.js";
import { webhookSecret } from "./stripe-client.js";
import { processStripeEvent, verifyStripeEvent, type EventLog } from "./stripe-rules.js";

// Stripe Checkout endpoints (plan §6.4):
//
//   POST /api/checkout        { agentSlug } -> { url }   (session user; the web redirects to the hosted checkout)
//   GET  /api/purchases/:id   charge status for its buyer (routes.ts, mounted through checkoutRouter)
//   POST /api/stripe/webhook  raw body, Stripe-Signature  (mounted by app.ts with express.raw BEFORE express.json)
//
// The webhook is the source of truth: a paid session moves the ledger row to `fulfilled` and grants the license in one
// transaction. The success_url only brings the buyer back to the library.

initPayments();

/** An unpaid session younger than this is handed out again instead of opening a second one (sessions live 24 h). */
const REUSE_SESSION_MS = 23 * 3600_000;

const CheckoutInput = z.object({ agentSlug: z.string().trim().min(1).max(100) });

export const checkoutRouter = Router();

checkoutRouter.use(paymentsRouter);

checkoutRouter.post(
  "/checkout",
  requireUser,
  h(async (req): Promise<{ url: string }> => {
    const userId = req.userId;
    if (!userId) throw unauthorized();
    const { agentSlug } = parse(CheckoutInput, req.body);
    const { intent, agent } = await prepareCheckout(agentSlug, userId);

    // A double click or a second tab gets the session already open for the same price.
    const [open] = await db
      .select()
      .from(schema.paymentLedger)
      .where(
        and(
          eq(schema.paymentLedger.provider, "stripe"),
          eq(schema.paymentLedger.buyerUserId, userId),
          eq(schema.paymentLedger.agentId, agent.id),
          eq(schema.paymentLedger.status, "pending_payment"),
          eq(schema.paymentLedger.amountCents, intent.amountCents),
          gt(schema.paymentLedger.createdAt, new Date(Date.now() - REUSE_SESSION_MS)),
        ),
      )
      .orderBy(desc(schema.paymentLedger.createdAt))
      .limit(1);
    const reuse = open && payloadOf(open).webUrl === env.PUBLIC_WEB_URL ? payloadOf(open).checkoutUrl : undefined;
    if (typeof reuse === "string") return { url: reuse };

    const [user] = await db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    const charge = await stripeProvider().createCharge(intent, {
      now: new Date(),
      ip: req.ip ?? null,
      customerEmail: user?.email ?? null,
      agent: { slug: agent.slug, name: agent.name },
    });
    return { url: String(charge.payment!.url) };
  }),
);

/**
 * `stripe_events` as the dedup log: the insert is a no-op for a known id, and an event counts as a duplicate only once
 * it was processed, so a delivery whose handling failed (500, Stripe retries) is handled again.
 */
export const stripeEventLog: EventLog = {
  async begin(id, type) {
    await db.insert(schema.stripeEvents).values({ id, type }).onConflictDoNothing({ target: schema.stripeEvents.id });
    const [row] = await db.select({ processedAt: schema.stripeEvents.processedAt }).from(schema.stripeEvents).where(eq(schema.stripeEvents.id, id));
    return !row?.processedAt;
  },
  async done(id) {
    await db.update(schema.stripeEvents).set({ processedAt: new Date() }).where(eq(schema.stripeEvents.id, id));
  },
};

/** POST /api/stripe/webhook. Expects `express.raw({ type: "application/json" })`, so `req.body` is the exact Buffer Stripe signed. */
export const stripeWebhookHandler: RequestHandler = async (req, res) => {
  let secret: string;
  try {
    secret = webhookSecret();
  } catch (e) {
    console.error("[payments] stripe webhook:", (e as Error).message);
    res.status(500).json({ error: "Webhook not configured", code: "webhook_not_configured" });
    return;
  }
  let event: Stripe.Event;
  try {
    if (!Buffer.isBuffer(req.body)) throw new Error("the body is not raw (mount the route with express.raw before express.json)");
    event = verifyStripeEvent(req.body, req.headers["stripe-signature"], secret);
  } catch (e) {
    console.warn("[payments] stripe webhook rejected:", (e as Error).message);
    res.status(400).json({ error: "Invalid webhook signature", code: "invalid_signature" });
    return;
  }
  try {
    const result = await processStripeEvent(event, stripeEventLog, (outcome, session) => stripeProvider().settleSession(outcome, session));
    res.json({ received: true, result });
  } catch (e) {
    // Not marked processed: Stripe retries and the handler runs again (it is idempotent).
    console.error(`[payments] stripe webhook ${event.id} (${event.type}) failed:`, (e as Error).message);
    res.status(500).json({ error: "Webhook handling failed", code: "internal" });
  }
};
