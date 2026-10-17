import Stripe from "stripe";

import { env } from "../env.js";

// The one Stripe client of the server, created on first use from STRIPE_SECRET_KEY (test mode), so modules that only
// import the payments code (tests, CLIs) never need the key. Webhook verification does not use it (stripe-rules.ts).

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (client) return client;
  const key = env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client = new Stripe(key, { appInfo: { name: "Solvers" }, maxNetworkRetries: 2 });
  return client;
}

/** STRIPE_WEBHOOK_SECRET (`whsec_…`, from the dashboard endpoint or `stripe listen`). */
export function webhookSecret(): string {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return secret;
}

/** Test hook: replaces the client (null = recreate from env on next use). */
export function setStripeClient(c: Stripe | null): void {
  client = c;
}
