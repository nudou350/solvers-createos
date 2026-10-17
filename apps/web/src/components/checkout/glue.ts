"use client";
// Glue between the storefront/checkout screens and the app foundation (session, error text, Stripe Checkout). Every
// foundation call of this area goes through here, so an interface change is fixed in one place.
import { useLocale } from "next-intl";
import { useCallback, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { INTL_LOCALE, type Locale } from "@/i18n/routing";
import { useErrorInfo, useErrorText, type ErrorInfo } from "@/lib/error-text";
import { useSession } from "@/lib/session";
import { checkoutFailure, isCheckoutUrl, resumeBuyPath } from "./rules";

/** Page locale and its Intl form ("en-US", "pt-BR"). */
export function usePageLocale(): { locale: Locale; intl: string } {
  const locale = useLocale() as Locale;
  return { locale, intl: INTL_LOCALE[locale] ?? "en-US" };
}

export type CheckoutSession = {
  /** "loading" until the session is known. */
  status: "loading" | "signed-out" | "signed-in";
  /** User id of the session; null when signed out. */
  userId: string | null;
  /** Sends the person to the sign-in page and back here (or to `next`). */
  signIn: (next?: string) => void;
  signOut: () => Promise<void>;
};

/** Session state for the storefront and checkout screens. */
export function useCheckoutSession(): CheckoutSession {
  const { status, userId, signIn, signOut } = useSession();
  return { status, userId: status === "signed-in" ? userId : null, signIn, signOut };
}

export type StripeCheckout = {
  /** Creates the Checkout Session and leaves for Stripe's hosted page. */
  start: () => Promise<void>;
  /** True from the click until the browser leaves for Stripe (or the call fails). */
  pending: boolean;
  error: ErrorInfo | null;
};

/**
 * "Buy with Stripe" for one Solver: `POST /api/checkout { agentSlug }` with the session cookie, then the browser goes to
 * the returned Stripe URL. Signed out (401): sign in first and come back to the Solver page with `?buy=1`. Already
 * owned (409): the library.
 */
export function useStripeCheckout(slug: string): StripeCheckout {
  const { signIn, api } = useSession();
  const router = useRouter();
  const info = useErrorInfo();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const start = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const { url } = await api.createCheckout(slug);
      if (!isCheckoutUrl(url, window.location.origin)) throw new Error("unexpected checkout url");
      window.location.assign(url);
      // Stays pending: the page is leaving.
    } catch (e) {
      setPending(false);
      const failure = checkoutFailure(e);
      if (failure === "login") signIn(resumeBuyPath(slug));
      else if (failure === "owned") router.push("/library");
      else setError(info(e));
    }
  }, [slug, api, signIn, router, info]);
  return { start, pending, error };
}

/** Error text in the page language (`errors` namespace). */
export function useErrText(): (e: unknown) => string {
  return useErrorText();
}
