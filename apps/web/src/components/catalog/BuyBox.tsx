"use client";
// Buy box of a Solver page: lifetime access (price in US dollars, paid with Stripe Checkout), free trial and the
// signed-in user's access. Platform Solvers are free and only show how to install them.
import type { TrialInfo } from "@solvers/api-client";
import { useTranslations } from "next-intl";
import { type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Icon } from "@/components/ui/Icon";
import { useFormat } from "@/lib/format";
import { useMyAccess } from "@/lib/hooks";
import { useStripeCheckout } from "@/components/checkout/glue";
import { gap } from "@/lib/style";

export type BuyBoxProps = {
  slug: string;
  name: string;
  /** Lifetime access price, in integer USD cents. */
  priceCents: number;
  /** Free trial configured by the creator; null = no trial. */
  trial: TrialInfo | null;
  /** Platform Solver: free, no license and no purchase. Hides the price and the buy button. */
  platform?: boolean;
};

/** Box of a platform Solver: no price or purchase, only how to install it. */
function PlatformBox({ slug }: { slug: string }) {
  const t = useTranslations("catalog.buy");
  const install = `/install?agent=${encodeURIComponent(slug)}`;
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="sol-line" style={{ borderRadius: 0, height: 4 }} />
      <div className="pad col" style={gap("18px")}>
        <div className="col" style={gap("4px")}>
          <span className="eyebrow">{t("platformTitle")}</span>
          <span className="display big num" style={{ fontSize: 56, whiteSpace: "nowrap" }}>
            {t("free")}
          </span>
          <span className="small faint">{t("noPurchase")}</span>
        </div>
        <Button href={install} size="lg" block iconRight="arrow-right">
          {t("install")}
        </Button>
        <ol className="col small" style={gap("10px")}>
          <Step n={1}>{t("step1")}</Step>
          <Step n={2}>{t("step2")}</Step>
          <Step n={3}>{t("step3")}</Step>
        </ol>
        <ul className="col small" style={gap("10px")}>
          <Check>{t("check1")}</Check>
          <Check>{t("check2")}</Check>
        </ul>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="row start" style={gap("10px")}>
      <span className="dot dot-now" aria-hidden style={{ width: 24, height: 24, fontSize: 12, borderWidth: 1.5 }}>
        {n}
      </span>
      <span className="grow">{children}</span>
    </li>
  );
}

export function BuyBox(p: BuyBoxProps) {
  if (p.platform) return <PlatformBox slug={p.slug} />;
  return <PaidBox {...p} />;
}

function PaidBox(p: BuyBoxProps) {
  const t = useTranslations("catalog.buy");
  const tTrial = useTranslations("catalog.trial");
  const f = useFormat();
  // Ownership is decided by the server for the session's user id (`GET /api/me/access/:slug` -> license id).
  const access = useMyAccess(p.slug);
  const checkout = useStripeCheckout(p.slug);
  const install = `/install?agent=${encodeURIComponent(p.slug)}`;
  const owned = !!access?.license;
  const trialLeft = p.trial && access ? access.trialUsesLeft : null;

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="sol-line" style={{ borderRadius: 0, height: 4 }} />
      <div className="pad col" style={gap("18px")}>
        {owned ? (
          <div className="note note-ok" role="status">
            <Icon name="check-circle" />
            <div className="note-body">
              <span className="note-title">{t("ownedTitle")}</span>
              <span className="small">{t("ownedBody")}</span>
              <div className="note-actions">
                <Button href={install} size="sm" iconRight="arrow-right">
                  {t("goInstall")}
                </Button>
                <Button href="/library" size="sm" variant="secondary">
                  {t("library")}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {owned ? null : (
          <>
            <div className="col" style={gap("2px")}>
              <span className="eyebrow">{t("permanent")}</span>
              <div className="row price-row" style={gap("10px", { alignItems: "baseline" })}>
                <span className="display big num price-big" style={{ fontSize: 60, whiteSpace: "nowrap" }}>
                  {f.usd(p.priceCents)}
                </span>
                <span className="muted">{t("oneTime")}</span>
              </div>
            </div>
            <Button size="lg" block iconRight="arrow-right" loading={checkout.pending} onClick={() => void checkout.start()}>
              {t("buy")}
            </Button>
            {checkout.error ? <ErrorNotice error={checkout.error} onRetry={() => void checkout.start()} /> : null}
            {p.trial ? (
              <div className="col" style={gap("8px")}>
                <Button href={install} variant="secondary" block icon="play">
                  {t("tryFree")}
                </Button>
                <p className="small muted center" role="status">
                  {trialLeft == null
                    ? t("trialTry", { uses: tTrial("uses", { n: p.trial.uses }) })
                    : trialLeft > 0
                      ? t("trialLeft", { left: trialLeft, uses: tTrial("uses", { n: p.trial.uses }) })
                      : t("trialOver")}{" "}
                  <a className="link" href="#teste-gratis">
                    {t("seeTrial")}
                  </a>
                </p>
              </div>
            ) : null}
          </>
        )}
        <ul className="col small" style={gap("10px")}>
          <Check>{t("sandboxProof")}</Check>
          <Check>{t("stripeSecure")}</Check>
          {p.trial ? <Check>{t("trialInAi")}</Check> : null}
        </ul>
      </div>
    </div>
  );
}

function Check({ children }: { children: ReactNode }) {
  return (
    <li className="row start" style={gap("10px")}>
      <span className="ok">
        <Icon name="check-circle" size="s" />
      </span>
      <span className="grow">{children}</span>
    </li>
  );
}
