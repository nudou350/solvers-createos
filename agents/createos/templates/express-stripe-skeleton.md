# Express 5 + Stripe Checkout + webhook skeleton (with tests)

A small, tested base for any "API that takes a payment" idea: a `/health` endpoint, an order created by `POST /orders` that opens a Stripe Checkout Session (test mode, integer cents), and a `/webhook` that verifies the Stripe signature over the raw body and marks the order paid exactly once. Tests use native `node:test` and `fetch` and make **no network call** (the sandbox cannot reach `api.stripe.com`): the webhook is signed locally with `stripe.webhooks.generateTestHeaderString`, and `checkout.sessions.create` is a fake that records its parameters.

Checked on 2026-10-17 with Express 5.3.0, stripe 23.0.0 and Node 22/24: 9 tests pass (`npm test`), 5 in `npm run test:webhook`.

How to use it in the sandbox: send every file below in one `sandbox_run` call (`files: [{ path: "/workspace/app/package.json", content: "..." }, ...]`) with the command `bash -lc "cd /workspace/app && npm install --no-audit --no-fund"`. Then rename the domain: "order" becomes "reservation", "subscription", "link", whatever the spec says, and add the spec's own routes and tests. Keep the three invariants: webhook route before `express.json()`, signature checked with `constructEvent`, fulfillment idempotent.

Environment variables (set on CreateOS, never in the sandbox): `PORT` (default 3000), `STRIPE_SECRET_KEY` (`sk_test_...`; without it `/orders` answers 503 and the rest works), `STRIPE_WEBHOOK_SECRET` (`whsec_...`), `PUBLIC_URL` (the live URL, for the redirects), `PRICE_CENTS`, `PRODUCT_NAME`.

## package.json

```json
{
  "name": "app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test test/*.test.js",
    "test:webhook": "node --test test/webhook.test.js"
  },
  "dependencies": {
    "express": "^5.3.0",
    "stripe": "^23.0.0"
  }
}
```

## src/app.js

```js
import express from "express";

// Builds the app without starting it, so tests can inject a fake Stripe client and an in-memory store.
// deps: { stripe, webhookSecret, publicUrl, priceCents, productName, store }
export function createApp(deps) {
  const { stripe, webhookSecret, publicUrl, priceCents, productName, store } = deps;
  const app = express();

  // The webhook needs the RAW body to check the signature: register it BEFORE express.json().
  app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], webhookSecret);
    } catch (err) {
      return res.status(400).json({ error: `Webhook signature check failed: ${err.message}` });
    }
    // Stripe can deliver the same event more than once: process each event id once.
    if (!store.markEventSeen(event.id)) return res.json({ received: true, duplicate: true });

    const session = event.data.object;
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        if (session.payment_status === "paid") store.markPaid(session.client_reference_id, session.id);
        break;
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        store.markFailed(session.client_reference_id);
        break;
      default:
        break; // other events are acknowledged and ignored
    }
    res.json({ received: true });
  });

  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.post("/orders", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(422).json({ error: "A valid email is required" });
    const order = store.createOrder({ email, amountCents: priceCents });
    if (!stripe.checkout) return res.status(503).json({ error: "Payments are not configured", order });

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [{ price_data: { currency: "usd", unit_amount: priceCents, product_data: { name: productName } }, quantity: 1 }],
        customer_email: email,
        client_reference_id: order.id,
        metadata: { orderId: order.id },
        success_url: `${publicUrl}/orders/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${publicUrl}/`,
      },
      { idempotencyKey: `order-${order.id}` },
    );
    res.status(201).json({ order, checkoutUrl: session.url });
  });

  app.get("/orders/:id", (req, res) => {
    const order = store.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  });

  // Last: any thrown error becomes a 500 without leaking the stack.
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  });

  return app;
}
```

## src/store.js

```js
import { randomUUID } from "node:crypto";

// In-memory store: enough for the sandbox and the tests. Swap for a database (same methods) before real traffic.
export function createStore() {
  const orders = new Map();
  const seenEvents = new Set();
  return {
    createOrder({ email, amountCents }) {
      const order = { id: randomUUID(), email, amountCents, status: "pending", checkoutSessionId: null };
      orders.set(order.id, order);
      return order;
    },
    getOrder: (id) => orders.get(id) ?? null,
    markPaid(id, checkoutSessionId) {
      const order = orders.get(id);
      if (order && order.status !== "paid") Object.assign(order, { status: "paid", checkoutSessionId });
    },
    markFailed(id) {
      const order = orders.get(id);
      if (order && order.status === "pending") order.status = "failed";
    },
    /** true the first time an event id is seen, false on a redelivery. */
    markEventSeen(eventId) {
      if (seenEvents.has(eventId)) return false;
      seenEvents.add(eventId);
      return true;
    },
  };
}
```

## src/server.js

```js
import Stripe from "stripe";
import { createApp } from "./app.js";
import { createStore } from "./store.js";

const port = Number(process.env.PORT ?? 3000);
const secretKey = process.env.STRIPE_SECRET_KEY;
if (secretKey && !secretKey.startsWith("sk_test_")) throw new Error("Use a Stripe TEST key (sk_test_...) until the app is reviewed");

// Without a key the app still starts (health, orders), and /orders answers 503 instead of creating a Checkout Session.
// The webhook check only needs the signing secret, so it works with a placeholder key.
const stripe = new Stripe(secretKey ?? "sk_test_placeholder");
const app = createApp({
  stripe: secretKey ? stripe : { webhooks: stripe.webhooks },
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${port}`,
  priceCents: Number(process.env.PRICE_CENTS ?? 500),
  productName: process.env.PRODUCT_NAME ?? "Reservation",
  store: createStore(),
});

// 0.0.0.0, not localhost: the sandbox preview and the CreateOS router reach the app from outside the VM.
app.listen(port, "0.0.0.0", () => console.log(`listening on 0.0.0.0:${port}`));
```

## test/helpers.js

```js
import Stripe from "stripe";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

export const WEBHOOK_SECRET = "whsec_test_secret";
// A real Stripe client is only used for its offline webhook helpers: no network call happens in the tests.
export const realStripe = new Stripe("sk_test_placeholder");

/** Starts the app on an ephemeral port. `checkout` replaces stripe.checkout (a fake records the params). */
export async function startApp({ checkout } = {}) {
  const store = createStore();
  const created = [];
  const fakeCheckout = checkout ?? {
    sessions: {
      create: async (params, opts) => {
        created.push({ params, opts });
        return { id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" };
      },
    },
  };
  const app = createApp({
    stripe: { webhooks: realStripe.webhooks, checkout: fakeCheckout },
    webhookSecret: WEBHOOK_SECRET,
    publicUrl: "http://localhost:3000",
    priceCents: 500,
    productName: "Reservation",
    store,
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, store, created, close: () => new Promise((r) => server.close(r)) };
}

/** Sends an event to /webhook signed like Stripe does (or with a wrong secret). */
export async function sendEvent(base, event, { secret = WEBHOOK_SECRET } = {}) {
  const payload = JSON.stringify(event);
  const header = realStripe.webhooks.generateTestHeaderString({ payload, secret });
  return fetch(`${base}/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body: payload,
  });
}

export function checkoutEvent(id, orderId, { type = "checkout.session.completed", paymentStatus = "paid" } = {}) {
  return {
    id,
    object: "event",
    type,
    data: { object: { id: "cs_test_123", object: "checkout.session", client_reference_id: orderId, payment_status: paymentStatus } },
  };
}
```

## test/app.test.js

```js
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { startApp } from "./helpers.js";

let app;
before(async () => (app = await startApp()));
after(() => app.close());

test("GET /health answers 200", async () => {
  const res = await fetch(`${app.base}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test("POST /orders creates a pending order and a Checkout Session in integer cents", async () => {
  const res = await fetch(`${app.base}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "buyer@example.com" }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.order.status, "pending");
  assert.match(body.checkoutUrl, /^https:\/\/checkout\.stripe\.com\//);
  const { params, opts } = app.created.at(-1);
  assert.equal(params.mode, "payment");
  assert.equal(params.line_items[0].price_data.unit_amount, 500);
  assert.equal(params.client_reference_id, body.order.id);
  assert.match(params.success_url, /\{CHECKOUT_SESSION_ID\}/);
  assert.equal(opts.idempotencyKey, `order-${body.order.id}`);
});

test("POST /orders rejects an invalid email with 422", async () => {
  const res = await fetch(`${app.base}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "nope" }),
  });
  assert.equal(res.status, 422);
});

test("GET /orders/:id returns 404 for an unknown order", async () => {
  const res = await fetch(`${app.base}/orders/does-not-exist`);
  assert.equal(res.status, 404);
});
```

## test/webhook.test.js

```js
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { checkoutEvent, sendEvent, startApp } from "./helpers.js";

let app;
before(async () => (app = await startApp()));
after(() => app.close());

test("webhook: a correctly signed checkout.session.completed marks the order paid", async () => {
  const order = app.store.createOrder({ email: "a@example.com", amountCents: 500 });
  const res = await sendEvent(app.base, checkoutEvent("evt_paid_1", order.id));
  assert.equal(res.status, 200);
  assert.equal(app.store.getOrder(order.id).status, "paid");
});

test("webhook: a wrong signature is rejected with 400 and changes nothing", async () => {
  const order = app.store.createOrder({ email: "b@example.com", amountCents: 500 });
  const res = await sendEvent(app.base, checkoutEvent("evt_forged_1", order.id), { secret: "whsec_wrong" });
  assert.equal(res.status, 400);
  assert.equal(app.store.getOrder(order.id).status, "pending");
});

test("webhook: a missing signature header is rejected with 400", async () => {
  const res = await fetch(`${app.base}/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(checkoutEvent("evt_nosig_1", "x")),
  });
  assert.equal(res.status, 400);
});

test("webhook: a redelivered event is processed once", async () => {
  const order = app.store.createOrder({ email: "c@example.com", amountCents: 500 });
  await sendEvent(app.base, checkoutEvent("evt_dup_1", order.id));
  const again = await sendEvent(app.base, checkoutEvent("evt_dup_1", order.id));
  assert.equal(again.status, 200);
  assert.equal((await again.json()).duplicate, true);
});

test("webhook: completed but unpaid (delayed method) does not mark the order paid", async () => {
  const order = app.store.createOrder({ email: "d@example.com", amountCents: 500 });
  await sendEvent(app.base, checkoutEvent("evt_unpaid_1", order.id, { paymentStatus: "unpaid" }));
  assert.equal(app.store.getOrder(order.id).status, "pending");
  await sendEvent(app.base, checkoutEvent("evt_async_ok_1", order.id, { type: "checkout.session.async_payment_succeeded" }));
  assert.equal(app.store.getOrder(order.id).status, "paid");
});
```

## Going further

- **Database**: replace `createStore()` with the same methods backed by Postgres (for example `neon/postgres` via Stripe Projects). Keep a unique constraint on the processed event id and make "mark paid" a conditional update (`where status <> 'paid'`).
- **Real Checkout from the preview**: not possible inside the sandbox (no egress to Stripe, no real key). Show the 503 response in the preview and do the real test payment after deploy.
- **Python instead of Node**: the same shape works with FastAPI and `stripe.Webhook.construct_event(payload, sig_header, secret)`; keep the raw body (`await request.body()`).
