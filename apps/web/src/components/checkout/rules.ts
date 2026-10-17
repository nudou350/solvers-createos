// Pure rules of the checkout (no React): query parsing, what a failed `POST /api/checkout` means and where the buyer
// goes back to. Unit-tested in test/checkout-rules.test.ts.
import { ApiError } from "@solvers/api-client";

/** First value of a query parameter, trimmed; null when missing or empty. */
export function param(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  const t = s?.trim();
  return t ? t : null;
}

/** What to do after `POST /api/checkout` failed: sign in first, open the library (already owned) or show the error. */
export type CheckoutFailure = "login" | "owned" | "error";

export function checkoutFailure(e: unknown): CheckoutFailure {
  if (e instanceof ApiError) {
    if (e.status === 401) return "login";
    if (e.status === 409 || e.code === "already_owned") return "owned";
  }
  return "error";
}

/** Page that resumes the purchase after sign-in: the Solver page with `?buy=1` (it opens the checkout on load). */
export function resumeBuyPath(slug: string): string {
  return `/solvers/${encodeURIComponent(slug)}?buy=1`;
}

/** Library page with the success banner (`?bought=<slug>`), the page Stripe returns to after paying. */
export function boughtPath(slug: string): string {
  return `/library?${new URLSearchParams({ bought: slug })}`;
}

/**
 * Only a Stripe-hosted page (the Checkout Session `url`) or a page of this site (a simulated checkout in development)
 * is followed.
 */
export function isCheckoutUrl(url: unknown, siteOrigin: string): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url, siteOrigin);
    if (u.origin === siteOrigin) return true;
    return u.protocol === "https:" && (u.hostname === "stripe.com" || u.hostname.endsWith(".stripe.com"));
  } catch {
    return false;
  }
}
