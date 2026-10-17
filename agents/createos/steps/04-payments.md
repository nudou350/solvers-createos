# Step 4: Payments (Stripe Checkout in test mode + verified webhook)

## Goal

Charge through a hosted Stripe Checkout Session in test mode and fulfill only from a webhook whose Stripe signature is verified over the raw body, processing each event once. Prove it in the sandbox with signed test payloads, without any network call to Stripe.

## What to ask the user

Confirm only what is missing from the spec: the amount in US$ (you store integer cents), one-off or recurring, and what "paid" unlocks (order status, reservation, access). Never ask for keys.

## How to run

1. **Read the rules first.** `search_knowledge` for "stripe checkout webhook signature" to get the current event names and the offline test helper.
2. **Checkout Session.** In the route that starts a purchase, create the order as `pending`, then `stripe.checkout.sessions.create` with `mode: "payment"` (or `"subscription"` with a Price ID for recurring), `price_data` with `currency: "usd"` and `unit_amount` in **integer cents**, `client_reference_id` = your order id, `success_url` with `?session_id={CHECKOUT_SESSION_ID}`, `cancel_url`, and `{ idempotencyKey: "order-<id>" }`. Return `session.url` (or redirect 303). Without `STRIPE_SECRET_KEY` the route answers 503 instead of crashing: the sandbox never has a real key.
3. **Webhook.** `app.post("/webhook", express.raw({ type: "application/json" }), ...)` registered **before** `app.use(express.json())`. Verify with `stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET)`; on failure answer 400 and change nothing. Handle `checkout.session.completed` (fulfill only if `payment_status === "paid"`), `checkout.session.async_payment_succeeded` (fulfill), `checkout.session.async_payment_failed` and `checkout.session.expired` (mark failed or release). Record the event id and skip a redelivery; make "mark paid" a no-op when already paid. Answer 2xx fast.
4. **Tests in `test/webhook.test.js`** (the gate runs exactly this file through `npm run test:webhook`). Sign payloads locally with `new Stripe("sk_test_placeholder").webhooks.generateTestHeaderString({ payload, secret })`. Minimum cases:
   - valid signature on `checkout.session.completed` with `payment_status: "paid"` -> 200 and the order is paid;
   - wrong secret -> 400 and the order stays pending;
   - missing `stripe-signature` header -> 400;
   - the same event id sent twice -> processed once;
   - `completed` with `payment_status: "unpaid"` -> not fulfilled; then `async_payment_succeeded` -> fulfilled.
   Also assert the Checkout params through an injected fake `checkout.sessions.create` (integer cents, `client_reference_id`, idempotency key) in the main suite.
5. **Run both.** One `sandbox_run`: `bash -lc "cd /workspace/app && npm run test:webhook && npm test 2>&1 | tail -n 60"`. Use the step 3 fix loop (checkpoint before risky changes, restore if worse).
6. **Show proof** and call `next_step`. The server runs `npm run test:webhook` and `npm test` and advances only if both exit 0.
7. **Prove the test bites.** In one sentence, name the change that would make each security test fail (for example "moving `express.json()` above the webhook route makes the valid-signature test return 400").

## Common mistakes

- `express.json()` before the webhook route: every real signature fails in production.
- Fulfilling on the `success_url` redirect instead of the webhook.
- Fulfilling `checkout.session.completed` without checking `payment_status`.
- No dedupe: a Stripe retry ships the order twice.
- Calling `api.stripe.com` in tests (blocked in the sandbox) or putting a real key in the sandbox.
- `unit_amount: 9.99` (float) instead of `999`.
- Live keys: everything here is test mode until the user decides otherwise.

## result_summary format

```
checkout: mode=<payment|subscription>; amount_cents=<n>; client_reference_id=<field>; idempotency=<key>
webhook: raw body before json=yes; constructEvent=yes; events=<list>; dedupe=<how>
tests: test:webhook <n> pass; npm test <n> pass, 0 fail
regressions_caught: <test -> change that breaks it>, ...
not_verified: real Checkout redirect and real webhook delivery (needs deploy + test key)
```
