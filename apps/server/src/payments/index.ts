import { StripeProvider } from "./providers/stripe.js";
import { getProvider, registerProvider } from "./registry.js";

// Boot of the payments module: registers the providers. Idempotent; the routers call it on import so mounting them is
// enough.

let ready = false;

export function initPayments(): void {
  if (ready) return;
  registerProvider(new StripeProvider());
  ready = true;
}

export const stripeProvider = () => getProvider<StripeProvider>("stripe");

/**
 * Reconciliation job body (schedule it every few minutes): Checkout Sessions still pending an hour after they were
 * opened are read from the Stripe API and settled (paid -> fulfilled with its license, expired -> expired), and paid
 * charges whose fulfilment was interrupted are finished. Returns how many charges changed status.
 */
export async function reconcileStripeCheckouts(now = new Date()): Promise<number> {
  initPayments();
  return (await stripeProvider().reconcile(now)).advanced;
}

export { registerProvider, getProvider, reconcileAll } from "./registry.js";
export { prepareCheckout } from "./intent.js";
