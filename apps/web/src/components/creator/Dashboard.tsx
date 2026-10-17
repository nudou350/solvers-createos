"use client";
import { ApiError, type CreatorDashboard } from "@solvers/api-client";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { AuthGate } from "@/components/ui/AuthGate";
import { Chip, RepBadge } from "@/components/ui/Chip";
import { Empty } from "@/components/ui/Empty";
import { Icon } from "@/components/ui/Icon";
import { Loading } from "@/components/ui/Spinner";
import { Tile } from "@/components/ui/Tile";
import { api } from "@/lib/api";
import { evalMethodNote, hasEvalScore } from "@/lib/eval-label";
import { useFormat } from "@/lib/format";
import { useSession } from "@/lib/session";
import { gap } from "@/lib/style";
import { useHeadline } from "./creator-glue";
import { CreatorHead } from "./CreatorHead";
import { DailyChart } from "./DailyChart";
import { OpenSubmissions } from "./OpenSubmissions";

type Dash = CreatorDashboard;
type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ok"; data: Dash };

/** Creator dashboard (/creator): requires sign-in; without published Solvers it shows how to start. */
export function CreatorDashboardView() {
  const t = useTranslations("creator.dashboard");
  const { status, me } = useSession();
  const lang = useLocale() as Locale;
  const [state, setState] = useState<State>({ kind: "loading" });
  // Translator kept in a ref: it must not refetch the dashboard on every render.
  const expired = useRef(t("sessionExpired"));
  expired.current = t("sessionExpired");

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setState({ kind: "loading" });
      try {
        const data = await api.getCreatorDashboard(lang);
        setState({ kind: "ok", data });
      } catch (e) {
        if (!silent) setState({ kind: "error", message: e instanceof ApiError && e.status === 401 ? expired.current : (e as Error).message });
      }
    },
    [lang],
  );

  useEffect(() => {
    if (status === "signed-in") void load();
  }, [status, me?.id, load]);

  if (status !== "signed-in")
    return (
      <Section>
        <CreatorHead tab="overview" />
        <AuthGate
          icon="pen"
          title={t("gate.title")}
          text={t("gate.text")}
          actions={
            <Button variant="secondary" href="/creator/publish">
              {t("gate.howTo")}
            </Button>
          }
        />
      </Section>
    );

  if (state.kind === "loading") return <Section><CreatorHead tab="overview" /><Loading text={t("loading")} /></Section>;
  if (state.kind === "error")
    return (
      <Section>
        <CreatorHead tab="overview" />
        <Empty icon="warning" title={t("loadFailTitle")} action={<Button onClick={() => void load()}>{t("retry")}</Button>}>
          {state.message}
        </Empty>
      </Section>
    );

  const { data } = state;
  if (!data.creator)
    return (
      <Section>
        <CreatorHead tab="overview" />
        <OpenSubmissions />
        <NotCreator sharePct={data.creatorSharePct} />
      </Section>
    );
  return (
    <Section>
      <CreatorHead tab="overview" reputation={data.creator.reputationScore} name={data.creator.name} />
      <OpenSubmissions />
      <Overview data={data} creator={data.creator} />
    </Section>
  );
}

function Section({ children }: { children: ReactNode }) {
  return (
    <section className="wrap" style={{ paddingTop: 44, paddingBottom: 56 }}>
      {children}
    </section>
  );
}

function NotCreator({ sharePct }: { sharePct: number }) {
  const t = useTranslations("creator.dashboard.notCreator");
  const f = useFormat();
  const points = [
    { icon: "gift" as const, title: t("free.title"), text: t("free.text") },
    { icon: "coin" as const, title: t("share.title", { pct: f.num(sharePct, 0, 1) }), text: t("share.text") },
    { icon: "shield-check" as const, title: t("quality.title"), text: t("quality.text") },
  ];
  return (
    <div className="card pad-l col" style={gap(28)}>
      <div className="col" style={gap(10, { maxWidth: 680 })}>
        <span className="eyebrow">{t("eyebrow")}</span>
        <h2 className="display h2s">{t("title")}</h2>
        <p className="lead">{t("lead")}</p>
      </div>
      <div className="g3 m1" style={gap(16)}>
        {points.map((p) => (
          <div key={p.title} className="card-flat pad-s col" style={gap(10)}>
            <span className="brand">
              <Icon name={p.icon} />
            </span>
            <b>{p.title}</b>
            <span className="small muted">{p.text}</span>
          </div>
        ))}
      </div>
      <div className="row wrapx" style={gap(12)}>
        <Button href="/creator/publish" size="lg" iconRight="arrow-right">
          {t("publish")}
        </Button>
        <Button href="/creator/submissions" size="lg" variant="secondary">
          {t("mySubmissions")}
        </Button>
      </div>
    </div>
  );
}

function Overview({ data, creator }: { data: Dash; creator: NonNullable<Dash["creator"]> }) {
  const t = useTranslations("creator.dashboard");
  const f = useFormat();
  const lang = useLocale() as Locale;
  const headline = useHeadline();
  const kpiN = { fontSize: 44, lineHeight: 1 } as CSSProperties;
  const kpiMoney = { fontSize: 40, lineHeight: 1, whiteSpace: "nowrap" } as CSSProperties;
  // All-time total, only when it differs from the last 30 days.
  const allTime = (total: number, last: number) => (total > last ? t("kpi.allTime", { n: f.int(total) }) : "");

  return (
    <>
      <div className="g3 m1" style={gap(16, { marginBottom: 24 })}>
        <div className="card pad-s col" style={gap(6)}>
          <span className="small muted">{t("kpi.sales30")}</span>
          <span className="display num" style={kpiN}>{f.int(data.last30.sales)}</span>
          <span className="tiny ok">{t("kpi.newSales")}{allTime(data.totals.sales, data.last30.sales)}</span>
        </div>
        <div className="card pad-s col" style={gap(6)}>
          <span className="small muted">{t("kpi.uses")}</span>
          <span className="display num" style={kpiN}>{f.int(data.last30.uses)}</span>
          <span className="tiny faint">{t("kpi.usesSub")}{allTime(data.totals.uses, data.last30.uses)}</span>
        </div>
        <div className="card pad-s col" style={gap(6)}>
          <span className="small muted">{t("kpi.revenue")}</span>
          <span className="display num kpi-n" style={kpiMoney}>{headline(data.last30.revenueCents)}</span>
          <span className="tiny faint">
            {t("kpi.revenueSub", { pct: f.num(data.creatorSharePct, 0, 1) })}
            {data.totals.salesRevenueCents > data.last30.revenueCents ? t("kpi.allTime", { n: f.usd(data.totals.salesRevenueCents) }) : ""}
          </span>
        </div>
      </div>

      <div className="g2 gs2" style={gap(24, { marginBottom: 24 })}>
        <div className="card pad">
          <DailyChart daily={data.daily} />
        </div>
        <div className="card pad col" style={gap(16, { alignItems: "flex-start" })}>
          <h2 className="h3">{t("reputation.title")}</h2>
          <div className="row" style={gap(20)}>
            <div className="ring" style={{ "--p": Math.round(creator.reputationScore) } as CSSProperties}>
              <div>
                <span className="display num" style={{ fontSize: 36 }}>{Math.round(creator.reputationScore)}</span>
              </div>
            </div>
            <div className="col grow" style={gap(4)}>
              <RepBadge score={creator.reputationScore} style={{ alignSelf: "flex-start" }} />
            </div>
          </div>
          <p className="small muted">{t("reputation.text")}</p>
          <Link className="link small" href={`/creators/${encodeURIComponent(creator.id)}`}>
            {t("reputation.profile")}
          </Link>
        </div>
      </div>

      <div className="card pad-s" style={{ padding: "8px 24px", marginBottom: 24 }}>
        <div className="row between wrapx" style={{ padding: "14px 0" }}>
          <h2 className="h3">{t("agents.title")}</h2>
          <Button variant="secondary" href="/creator/publish" icon="plus">
            {t("agents.publishNew")}
          </Button>
        </div>
        {data.agents.length === 0 ? (
          <div style={{ borderTop: "1px solid var(--line)" }}>
            <Empty bare icon="pen" title={t("agents.emptyTitle")}>
              {t("agents.emptyText")}
            </Empty>
          </div>
        ) : (
          <>
            <div className="cr-table cr-head hide-m" aria-hidden>
              <span>{t("agents.cols.agent")}</span>
              <span>{t("agents.cols.sold")}</span>
              <span>{t("agents.cols.uses")}</span>
              <span>{t("agents.cols.rating")}</span>
              <span>{t("agents.cols.performance")}</span>
              <span>{t("agents.cols.revenue")}</span>
            </div>
            {data.agents.map((a) => (
              <div key={a.agentId}>
                <div className="cr-table">
                  <span className="row" style={gap(12, { minWidth: 0 })}>
                    <Tile category={a.category} size="s" />
                    <span className="col" style={gap(4, { minWidth: 0 })}>
                      <Link className="trunc bold" href={`/solvers/${encodeURIComponent(a.slug)}`} style={{ fontWeight: 700 }}>
                        {a.name}
                      </Link>
                      <span className="tiny faint">
                        {t("agents.version", { version: a.version, status: t(`agents.status.${a.status}`) })}
                      </span>
                      {!a.listed ? (
                        <span>
                          <Chip tone="warn" icon="eye">{t("agents.hidden")}</Chip>
                        </span>
                      ) : null}
                      <span className="tiny faint">{t("agents.price", { price: f.usd(a.priceCents) })}</span>
                    </span>
                  </span>
                  <span className="num">
                    <span className="only-m tiny faint">{t("agents.cols.sold")} </span>
                    {f.int(a.sales)}
                  </span>
                  <span className="num">
                    <span className="only-m tiny faint">{t("agents.cols.uses")} </span>
                    {f.int(a.uses)}
                  </span>
                  <span className="num">
                    <span className="only-m tiny faint">{t("agents.cols.rating")} </span>
                    {a.userRating > 0 ? f.dec1(a.userRating) : "—"}
                  </span>
                  <span className={["num", !hasEvalScore(a.evalScore) ? "faint" : a.evalScore >= 80 ? "ok" : "warn"].join(" ")} title={hasEvalScore(a.evalScore) ? evalMethodNote(lang) : undefined}>
                    <span className="only-m tiny faint">{t("agents.cols.performance")} </span>
                    {hasEvalScore(a.evalScore) ? `${Math.round(a.evalScore)}%` : t("agents.noEvals")}
                  </span>
                  <b className="num">
                    <span className="only-m tiny faint">{t("agents.cols.revenue")} </span>
                    {f.usd(a.revenueCents)}
                  </b>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
