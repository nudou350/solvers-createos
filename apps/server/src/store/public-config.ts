import { CURRENCY, FREE_TRIAL_USES, PLATFORM_FEE_BPS, type PublicConfig } from "@solvers/shared";
import { env } from "../env.js";
import { MIN_PRICE_CENTS } from "../runtime/price.js";

/** GET /api/config: what the web needs to price, sign in and pay (no secrets). */
export function publicConfig(): PublicConfig {
  return {
    currency: CURRENCY,
    feeBps: PLATFORM_FEE_BPS,
    minPriceCents: MIN_PRICE_CENTS,
    stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY || null,
    devLogin: env.DEV_LOGIN,
    connectorUrl: `${env.PUBLIC_API_URL.replace(/\/$/, "")}/mcp`,
    freeTrialUses: FREE_TRIAL_USES,
  };
}
