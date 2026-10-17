"use client";
// Checkout of a Solver: one "Buy with Stripe" button. The API creates the Stripe Checkout Session (`POST /api/checkout`)
// and the browser goes to Stripe's hosted page; after paying, Stripe returns to /library?bought=<slug> and the license
// shows up once the webhook lands. Signed out: /login first, then back to the Solver page with ?buy=1.
import type { AgentDetail } from "@solvers/api-client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Icon } from "@/components/ui/Icon";
import { Price } from "@/components/ui/Price";
import { Notice } from "@/components/ui/Toast";
import { Tile } from "@/components/ui/Tile";
import { useMyAccess } from "@/lib/hooks";
import { gap } from "@/lib/style";
import { useCheckoutSession, useStripeCheckout } from "./glue";

export function CheckoutView({ detail }: { detail: AgentDetail }) {
  const t = useTranslations("checkout.view");
  const { agent, creator } = detail;
  const session = useCheckoutSession();
  const access = useMyAccess(agent.slug);
  const checkout = useStripeCheckout(agent.slug);
  const owned = !!access?.license;

  return (
    <>
      <div className="wrap" style={{ paddingTop: 28 }}>
        <Link className="link-btn" href={`/solvers/${encodeURIComponent(agent.slug)}`}>
          <Icon name="arrow-left" size="s" />
          {t("back")}
        </Link>
      </div>
      <section className="wrap" style={{ paddingTop: 8, paddingBottom: 56 }}>
        <h1 className="display h2" style={{ marginBottom: 28 }}>
          {t("title")}
        </h1>
        <div className="split">
          <div className="col" style={gap(22)}>
            <div className="card pad col" style={gap(18)}>
              <h2 className="h3">{t("pay.title")}</h2>
              {owned ? (
                <Notice
                  tone="ok"
                  title={t("owned.title")}
                  actions={
                    <Button size="sm" href="/library">
                      {t("owned.library")}
                    </Button>
                  }
                >
                  {t("owned.text")}
                </Notice>
              ) : (
                <>
                  <p className="muted">{t("pay.text")}</p>
                  <div>
                    <Button size="lg" icon="lock" loading={checkout.pending} disabled={session.status === "loading"} onClick={() => void checkout.start()}>
                      {t("pay.button")}
                    </Button>
                  </div>
                  {session.status === "signed-out" ? <p className="small muted">{t("pay.signInFirst")}</p> : null}
                  <p className="tiny faint">{t("pay.testMode")}</p>
                </>
              )}
              {checkout.error ? <ErrorNotice error={checkout.error} onRetry={() => void checkout.start()} /> : null}
            </div>

            <div className="card pad col" style={gap(14)}>
              <h2 className="h3">{t("how.title")}</h2>
              <ol className="col small" style={gap(10, { margin: 0, paddingLeft: 20 })}>
                <li>{t("how.s1")}</li>
                <li>{t("how.s2")}</li>
                <li>{t("how.s3")}</li>
              </ol>
            </div>
          </div>

          <aside className="sticky">
            <div className="card pad col" style={gap(18)}>
              <div className="row" style={gap(14)}>
                <Tile category={agent.category} />
                <div className="grow">
                  <b style={{ fontSize: 17 }}>{agent.name}</b>
                  <div className="small muted trunc">{t("summary.by", { creator: creator.name })}</div>
                </div>
              </div>
              <div className="divider" />
              <div className="row between" style={{ alignItems: "baseline" }}>
                <span className="bold">{t("summary.total")}</span>
                <Price cents={agent.priceCents} size="xl" />
              </div>
              <div className="tiny faint">{t("summary.oneTime")}</div>
              <div>
                <Chip tone="ok" icon="shield-check">
                  {t("summary.chip")}
                </Chip>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
