---
title: Stripe Checkout (hosted) and webhook signature verification in Node.js
source: Stripe documentation (Checkout quickstart, Checkout fulfillment, Webhooks) and stripe-node 23.0.0
source_url: https://docs.stripe.com/checkout/quickstart
source_date: 2026-10-17
valid_until: 2027-01-15
tags: [stripe, checkout, webhooks, signature, express, node, testing]
---

Other sources: https://docs.stripe.com/webhooks, https://docs.stripe.com/checkout/fulfillment. stripe-node 23.0.0 pins API version `2026-09-30.endive`.

## Create a Checkout Session (hosted page)

```js
const session = await stripe.checkout.sessions.create(
  {
    mode: "payment",
    line_items: [{ price_data: { currency: "usd", unit_amount: 900, product_data: { name: "Reservation" } }, quantity: 1 }],
    client_reference_id: order.id,
    metadata: { orderId: order.id },
    success_url: `${PUBLIC_URL}/orders/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${PUBLIC_URL}/`,
  },
  { idempotencyKey: `order-${order.id}` },
);
res.redirect(303, session.url); // or return { checkoutUrl: session.url } to an API client
```

- Money is an **integer in the smallest unit** (cents): `unit_amount: 900` is US$ 9.00. Never use floats.
- `line_items` takes either a Price ID (`price: "price_..."`) or inline `price_data`.
- `{CHECKOUT_SESSION_ID}` is replaced by Stripe in the redirect.
- The redirect to `success_url` is **not** proof of payment: fulfill only from the webhook.

## Webhook endpoint

```js
// BEFORE app.use(express.json()): the signature is computed over the raw bytes.
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  // ... handle, then
  res.json({ received: true });
});
```

- Header format: `Stripe-Signature: t=<timestamp>,v1=<signature>` (`v0` is test-only; ignore it). `v1` is HMAC-SHA256 of `<t>.<raw body>` with the endpoint secret.
- Default tolerance: **300 seconds** (`DEFAULT_TOLERANCE` in stripe-node). Do not set it to 0.
- Any change to the body (a JSON parser running first, a proxy re-encoding) breaks verification. The most common bug is `app.use(express.json())` registered before the webhook route.

## Which events to handle for Checkout

| Event | Action |
|---|---|
| `checkout.session.completed` | fulfill if `payment_status` is `paid` (a delayed method can complete as `unpaid`) |
| `checkout.session.async_payment_succeeded` | fulfill (delayed methods such as bank debits) |
| `checkout.session.async_payment_failed` | mark failed, tell the customer |
| `checkout.session.expired` | release the reservation |

Fulfillment must be **idempotent**: Stripe may call it more than once, even concurrently, for the same session. Store processed event ids (unique constraint) and make "mark paid" a no-op when already paid. Events can arrive out of order; do not rely on `created`.

## Delivery behavior

- Return 2xx quickly, before slow work (queue it).
- Live mode retries for up to 3 days with exponential backoff; test mode retries 3 times over a few hours.
- Resend: Dashboard (15 days) or `stripe events resend <event_id> --webhook-endpoint=<id>` (30 days).
- With `success_url` set and a `checkout.session.completed` listener, Checkout waits up to 10 seconds for your server before redirecting.

## Testing without network (what runs in the sandbox)

stripe-node signs test payloads offline, so the signature test needs no Stripe account and no egress:

```js
const stripe = new Stripe("sk_test_placeholder"); // no API call is made
const payload = JSON.stringify(event);
const header = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_secret" });
await fetch(`${base}/webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body: payload });
```

Cover at least: valid signature marks the order paid; wrong secret gives 400 and changes nothing; missing header gives 400; a redelivered event id is processed once; `completed` with `payment_status: "unpaid"` does not fulfill. For `checkout.sessions.create`, inject a fake and assert the params (integer cents, `client_reference_id`, idempotency key).

## Testing end to end (user's machine, after deploy or locally)

- `stripe listen --forward-to localhost:3000/webhook` prints a `whsec_...` secret for local forwarding.
- `stripe trigger payment_intent.succeeded` sends a sample event; for Checkout, the reliable test is a real test-mode payment with card `4242 4242 4242 4242`, any future expiry, any CVC.
- Use test keys (`sk_test_...`) until the user explicitly goes live.
