import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";

import { HttpError } from "../src/lib/http.js";
import {
  CHECKOUT_EVENTS,
  MIN_PRICE_CENTS,
  checkoutBlock,
  checkoutOutcome,
  checkoutSessionParams,
  feeSplit,
  ledgerIdOf,
  processStripeEvent,
  sessionMismatch,
  verifyStripeEvent,
  type EventLog,
} from "../src/payments/stripe-rules.js";

// Stripe Checkout rules (plan §6.4). Pure: no database and no call to the Stripe API (signatures are computed locally
// with the SDK's test helper).

const SECRET = "whsec_test_secret_for_unit_tests";
const USER = "6f1c2b9e-1c39-4f57-9a43-0d6b8f2b7c11";
const AGENT = "0123456789abcdef0123456789abcdef";
const LEDGER = "9b2f7c1a-5d3e-4b8a-9c6f-1e2d3c4b5a69";

function session(over: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_test_123",
    object: "checkout.session",
    amount_total: 1900,
    currency: "usd",
    client_reference_id: LEDGER,
    metadata: { ledgerId: LEDGER, agentId: AGENT, userId: USER },
    payment_status: "paid",
    status: "complete",
    payment_intent: "pi_test_123",
    ...over,
  } as Stripe.Checkout.Session;
}

function event(type: string, obj: Stripe.Checkout.Session, id = "evt_test_1"): Stripe.Event {
  return { id, object: "event", type, data: { object: obj } } as unknown as Stripe.Event;
}

function signed(payload: string, secret = SECRET, timestamp?: number) {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret, ...(timestamp ? { timestamp } : {}) });
}

test("webhook signature: a correctly signed raw body is accepted and parsed", () => {
  const payload = JSON.stringify(event("checkout.session.completed", session()));
  const ev = verifyStripeEvent(Buffer.from(payload), signed(payload), SECRET);
  assert.equal(ev.id, "evt_test_1");
  assert.equal(ev.type, "checkout.session.completed");
});

test("webhook signature: wrong secret, tampered body, missing header and stale timestamp are rejected", () => {
  const payload = JSON.stringify(event("checkout.session.completed", session()));
  assert.throws(() => verifyStripeEvent(payload, signed(payload, "whsec_other"), SECRET));
  const tampered = payload.replace('"amount_total":1900', '"amount_total":1');
  assert.notEqual(tampered, payload);
  assert.throws(() => verifyStripeEvent(tampered, signed(payload), SECRET));
  assert.throws(() => verifyStripeEvent(payload, undefined, SECRET), /missing Stripe-Signature/);
  const anHourAgo = Math.floor(Date.now() / 1000) - 3600;
  assert.throws(() => verifyStripeEvent(payload, signed(payload, SECRET, anHourAgo), SECRET));
});

/** In-memory `stripe_events`: same semantics as the table (insert-or-ignore, processed_at set when done). */
function memoryLog(): EventLog & { rows: Map<string, { type: string; processed: boolean }> } {
  const rows = new Map<string, { type: string; processed: boolean }>();
  return {
    rows,
    async begin(id, type) {
      if (!rows.has(id)) rows.set(id, { type, processed: false });
      return !rows.get(id)!.processed;
    },
    async done(id) {
      rows.get(id)!.processed = true;
    },
  };
}

test("event idempotency: a redelivered event is applied once", async () => {
  const log = memoryLog();
  const calls: string[] = [];
  const handle = async (outcome: string, s: Stripe.Checkout.Session) => void calls.push(`${outcome}:${s.id}`);
  const ev = event("checkout.session.completed", session());
  assert.equal(await processStripeEvent(ev, log, handle), "handled");
  assert.equal(await processStripeEvent(ev, log, handle), "duplicate");
  assert.equal(await processStripeEvent(ev, log, handle), "duplicate");
  assert.deepEqual(calls, ["paid:cs_test_123"]);
  assert.deepEqual(log.rows.get("evt_test_1"), { type: "checkout.session.completed", processed: true });
});

test("event idempotency: a delivery whose handling failed is handled again on the retry", async () => {
  const log = memoryLog();
  let attempts = 0;
  const flaky = async () => {
    attempts++;
    if (attempts === 1) throw new Error("db down");
  };
  const ev = event("checkout.session.async_payment_succeeded", session(), "evt_retry");
  await assert.rejects(processStripeEvent(ev, log, flaky), /db down/);
  assert.equal(log.rows.get("evt_retry")!.processed, false);
  assert.equal(await processStripeEvent(ev, log, flaky), "handled");
  assert.equal(await processStripeEvent(ev, log, flaky), "duplicate");
  assert.equal(attempts, 2);
});

test("event idempotency: unrelated events are recorded and ignored", async () => {
  const log = memoryLog();
  let called = false;
  const ev = { id: "evt_other", object: "event", type: "customer.created", data: { object: {} } } as unknown as Stripe.Event;
  assert.equal(
    await processStripeEvent(ev, log, async () => {
      called = true;
    }),
    "ignored",
  );
  assert.equal(called, false);
  assert.equal(log.rows.get("evt_other")!.processed, true);
});

test("checkout outcomes: paid, async, failed, expired; an unpaid completion waits", () => {
  assert.equal(checkoutOutcome(event("checkout.session.completed", session()))?.outcome, "paid");
  assert.equal(checkoutOutcome(event("checkout.session.completed", session({ payment_status: "unpaid" }))), null);
  assert.equal(checkoutOutcome(event("checkout.session.async_payment_succeeded", session()))?.outcome, "paid");
  assert.equal(checkoutOutcome(event("checkout.session.async_payment_failed", session()))?.outcome, "failed");
  assert.equal(checkoutOutcome(event("checkout.session.expired", session({ status: "expired" })))?.outcome, "expired");
  assert.deepEqual([...CHECKOUT_EVENTS].sort(), [
    "checkout.session.async_payment_failed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.completed",
    "checkout.session.expired",
  ]);
});

test("fee split: 10% to the platform (floor), the rest to the creator, integer cents", () => {
  assert.deepEqual(feeSplit(500), { feeCents: 50, creatorCents: 450 });
  assert.deepEqual(feeSplit(1900), { feeCents: 190, creatorCents: 1710 });
  assert.deepEqual(feeSplit(999), { feeCents: 99, creatorCents: 900 });
  assert.deepEqual(feeSplit(1), { feeCents: 0, creatorCents: 1 });
  assert.deepEqual(feeSplit(0), { feeCents: 0, creatorCents: 0 });
  for (const amount of [500, 501, 777, 1234, 4999, 100_000, 9_999_999]) {
    const { feeCents, creatorCents } = feeSplit(amount);
    assert.ok(Number.isInteger(feeCents) && Number.isInteger(creatorCents));
    assert.equal(feeCents + creatorCents, amount);
    assert.ok(feeCents <= amount / 10);
  }
  assert.deepEqual(feeSplit(1000, 2_000), { feeCents: 200, creatorCents: 800 });
  assert.throws(() => feeSplit(10.5), RangeError);
  assert.throws(() => feeSplit(-1), RangeError);
  assert.throws(() => feeSplit(100, 10_001), RangeError);
});

test("checkout guards: already owned is 409, creator can't buy, minimum is US$ 5", () => {
  const ok = { userId: USER, creatorUserId: "someone-else", ownedLicenseId: null, priceCents: MIN_PRICE_CENTS };
  assert.equal(checkoutBlock(ok), null);
  assert.equal(checkoutBlock({ ...ok, creatorUserId: null }), null);
  const owned = checkoutBlock({ ...ok, ownedLicenseId: "lic-1" });
  assert.ok(owned instanceof HttpError);
  assert.equal(owned.status, 409);
  assert.equal(owned.code, "already_owned");
  assert.deepEqual(owned.extra, { licenseId: "lic-1" });
  assert.equal(checkoutBlock({ ...ok, creatorUserId: USER })?.code, "creator_cannot_buy");
  const cheap = checkoutBlock({ ...ok, priceCents: MIN_PRICE_CENTS - 1 });
  assert.equal(cheap?.status, 409);
  assert.equal(cheap?.code, "below_min_price");
});

test("checkout session params: one-time USD payment, ledger id everywhere, return URLs", () => {
  const p = checkoutSessionParams({
    ledgerId: LEDGER,
    userId: USER,
    customerEmail: "buyer@example.com",
    agent: { id: AGENT, slug: "createos-builder", name: "CreateOS Builder" },
    amountCents: 1900,
    webUrl: "http://localhost:3041/",
  });
  assert.equal(p.mode, "payment");
  assert.deepEqual(p.line_items, [{ price_data: { currency: "usd", unit_amount: 1900, product_data: { name: "CreateOS Builder" } }, quantity: 1 }]);
  assert.equal(p.customer_email, "buyer@example.com");
  assert.equal(p.client_reference_id, LEDGER);
  assert.deepEqual(p.metadata, { ledgerId: LEDGER, agentId: AGENT, userId: USER });
  assert.equal(p.success_url, "http://localhost:3041/library?bought=createos-builder");
  assert.equal(p.cancel_url, "http://localhost:3041/solvers/createos-builder");
  const noEmail = checkoutSessionParams({ ledgerId: LEDGER, userId: USER, customerEmail: null, agent: { id: AGENT, slug: "x", name: "X" }, amountCents: 500, webUrl: "https://solvers.example" });
  assert.equal("customer_email" in noEmail, false);
});

test("paid session vs ledger: matches, and every mismatch is caught", () => {
  const row = { amountCents: 1900, currency: "usd", userId: USER, agentId: AGENT, providerRef: "cs_test_123" };
  assert.equal(ledgerIdOf(session()), LEDGER);
  assert.equal(ledgerIdOf(session({ metadata: {} })), LEDGER); // falls back to client_reference_id
  assert.equal(sessionMismatch(row, session()), null);
  assert.equal(sessionMismatch({ ...row, providerRef: null }, session()), null);
  assert.match(sessionMismatch(row, session({ amount_total: 100 }))!, /amount/);
  assert.match(sessionMismatch(row, session({ currency: "eur" }))!, /currency/);
  assert.match(sessionMismatch(row, session({ id: "cs_other" }))!, /not the charge's session/);
  assert.match(sessionMismatch(row, session({ metadata: { ledgerId: LEDGER, agentId: AGENT, userId: "intruder" } }))!, /user/);
  assert.match(sessionMismatch(row, session({ metadata: { ledgerId: LEDGER, agentId: "other", userId: USER } }))!, /agent/);
});
