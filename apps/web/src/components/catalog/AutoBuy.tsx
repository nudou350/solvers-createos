"use client";
// Resumes a purchase after sign-in: the Solver page with `?buy=1` opens the Stripe checkout once on load. While it
// prepares, a status line is shown; a failure shows the error with a retry.
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { useCheckoutSession, useStripeCheckout } from "@/components/checkout/glue";
import { useMyAccess } from "@/lib/hooks";

export function AutoBuy({ slug }: { slug: string }) {
  const t = useTranslations("catalog.buy");
  const { status } = useCheckoutSession();
  const access = useMyAccess(slug);
  const checkout = useStripeCheckout(slug);
  const started = useRef(false);
  const owned = !!access?.license;

  useEffect(() => {
    // Signed out: the call answers 401 and sends the person to sign in. Already owned: nothing to buy.
    if (started.current || status === "loading" || owned) return;
    if (status === "signed-in" && access === null) return; // wait for the access check
    started.current = true;
    void checkout.start();
  }, [status, access, owned, checkout]);

  if (checkout.error) return <ErrorNotice error={checkout.error} onRetry={() => void checkout.start()} />;
  if (checkout.pending)
    return (
      <p className="small muted center" role="status" style={{ marginTop: 12 }}>
        {t("redirecting")}
      </p>
    );
  return null;
}
