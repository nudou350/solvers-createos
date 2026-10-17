"use client";
// "Solvers" tab of the library: the Solvers the person owns, with the last 8 weeks of usage, free trials and reviews.
// After a Stripe payment the buyer lands here with `?bought=<slug>`: a banner confirms the purchase, re-reading the list
// for a few seconds while the payment webhook records it.
import type { MyTrial, UsageSummary } from "@solvers/shared";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ReviewBox } from "@/components/catalog/ReviewBox";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Empty } from "@/components/ui/Empty";
import { Icon } from "@/components/ui/Icon";
import { Loading } from "@/components/ui/Spinner";
import { Tile } from "@/components/ui/Tile";
import { Notice } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { spark, useFormat } from "@/lib/format";
import { useAgentsIndex } from "@/lib/hooks";
import { gap } from "@/lib/style";
import { BOUGHT_POLL, boughtSlug, boughtState } from "./account-rules";
import { useLibrary } from "./LibraryShell";
import { LoadError } from "./shared";
import { TrialsSection } from "./TrialsSection";

/** Banner after a Stripe payment (`?bought=<slug>`): confirming while the payment is recorded, then done. */
function BoughtBanner({ slug }: { slug: string }) {
  const { licenses, reloadLicenses } = useLibrary();
  const t = useTranslations("account.bought");
  const list = Array.isArray(licenses) ? licenses : [];
  const agents = useAgentsIndex(list.map((l) => l.agentId));
  const owned = list.map((l) => agents.get(l.agentId)?.slug).filter((x): x is string => !!x);
  // Until the Solver names load, the state is not known yet: say "confirming" (never a false "done").
  const state = boughtState(slug, owned);
  const name = list.map((l) => agents.get(l.agentId)).find((a) => a?.slug.toLowerCase() === slug)?.name ?? slug;
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (state === "done" || tries >= BOUGHT_POLL.attempts || !Array.isArray(licenses)) return;
    const id = setTimeout(() => {
      setTries((n) => n + 1);
      reloadLicenses({ quiet: true });
    }, BOUGHT_POLL.intervalMs);
    return () => clearTimeout(id);
  }, [state, tries, licenses, reloadLicenses]);

  if (state === "done")
    return (
      <Notice tone="ok" role="status" title={t("doneTitle")}>
        {t("doneText", { name })}
      </Notice>
    );
  const gaveUp = tries >= BOUGHT_POLL.attempts;
  return (
    <Notice
      tone={gaveUp ? "warn" : "info"}
      role="status"
      title={t("confirmingTitle")}
      actions={
        gaveUp ? (
          <Button size="sm" variant="secondary" icon="refresh" onClick={() => (setTries(0), reloadLicenses({ quiet: true }))}>
            {t("refresh")}
          </Button>
        ) : undefined
      }
    >
      {gaveUp ? t("slowText") : t("confirmingText")}
    </Notice>
  );
}

export function Licenses() {
  const { licenses, reloadLicenses } = useLibrary();
  const t = useTranslations("account");
  const f = useFormat();
  const bought = boughtSlug(useSearchParams().get("bought"));
  const [usage, setUsage] = useState<Map<string, UsageSummary>>(new Map());
  // Free trials in progress; if the call fails, the license list still stands on its own.
  const [trials, setTrials] = useState<MyTrial[] | null>(null);
  // License with the review form open.
  const [reviewing, setReviewing] = useState<string | null>(null);
  const list = Array.isArray(licenses) ? licenses : [];
  const agents = useAgentsIndex([...list.map((l) => l.agentId), ...(trials ?? []).map((tr) => tr.agentId)]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getMyUsage().then((u) => setUsage(new Map(u.map((x) => [x.agentId, x]))), () => {});
    api.getMyTrials().then(setTrials, () => setTrials([]));
  }, []);

  const banner = bought ? <BoughtBanner slug={bought} /> : null;
  if (licenses === "error") return <LoadError onRetry={() => reloadLicenses()} text={t("licenses.loadError")} />;
  if (licenses === null || trials === null) return <Loading text={t("licenses.loading")} />;
  if (!list.length && !trials.length)
    return (
      <div className="col" style={gap(18)}>
        {banner}
        <Empty icon="library" title={t("licenses.emptyTitle")} action={<Button href="/">{t("licenses.explore")}</Button>}>
          {t("licenses.emptyText")}
        </Empty>
      </div>
    );

  return (
    <div ref={listRef} tabIndex={-1} role="region" aria-label={t("licenses.region")} className="col" style={gap(18, { outline: "none" })}>
      {banner}
      {trials.length ? <TrialsSection trials={trials} agents={agents} /> : null}
      {trials.length && list.length ? <h2 className="h4">{t("licenses.heading")}</h2> : null}
      {list.map((l) => {
        const a = agents.get(l.agentId);
        const u = usage.get(l.agentId);
        const weekly = u?.weekly ?? [0, 0, 0, 0, 0, 0, 0, 0];
        const uses = u?.usesThisMonth ?? 0;
        return (
          <article key={l.id} className="card" style={{ padding: 0 }}>
            <div className="lib-row" style={{ padding: "22px 24px" }}>
              <div className="row" style={gap(16, { minWidth: 0 })}>
                {a ? <Tile category={a.category} /> : <span className="tile" aria-hidden />}
                <div className="grow">
                  <h2 className="h4 trunc">{a?.name ?? t("shared.unnamedSolver")}</h2>
                  <div className="row wrapx" style={gap("6px 8px", { marginTop: 4 })}>
                    <Chip tone="brand">{t("licenses.permanent")}</Chip>
                    <span className="tiny faint">{t("licenses.since", { date: f.date(l.acquiredAt) })}</span>
                  </div>
                </div>
              </div>
              <div className="col" style={gap(6)}>
                <span className="small muted">{t("licenses.usage8w")}</span>
                <div className="row" style={gap(14)}>
                  <svg className="spark" width="96" height="30" viewBox="0 0 96 30" aria-hidden>
                    <path
                      d={spark(weekly.map((x) => x + 0.001), 96, 30)}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ color: "var(--brand)" }}
                    />
                  </svg>
                  <b className="num">{t("licenses.usesMonth", { n: uses })}</b>
                </div>
              </div>
              <div className="col" style={gap(6)}>
                <span className="small muted">{t("licenses.usage")}</span>
                <b className="ok row" style={gap(6)}>
                  <Icon name="check-circle" size="s" />
                  {t("licenses.unlimited")}
                </b>
              </div>
              <div className="row wrapx" style={gap(8, { justifyContent: "flex-end", maxWidth: 360 })}>
                {a ? (
                  <>
                    <Button variant="secondary" href={`/install?agent=${encodeURIComponent(a.slug)}`}>
                      {t("licenses.openInstall")}
                    </Button>
                    <Button variant="ghost" icon="star" aria-expanded={reviewing === l.id} onClick={() => setReviewing(reviewing === l.id ? null : l.id)}>
                      {t("licenses.review")}
                    </Button>
                    <Button variant="ghost" href={`/solvers/${encodeURIComponent(a.slug)}`}>
                      {t("licenses.viewSolver")}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            {a && reviewing === l.id ? (
              <div style={{ padding: "4px 24px 24px", borderTop: "1px solid var(--line)", paddingTop: 20 }}>
                <p className="tiny faint row" style={gap(8, { marginBottom: 12 })}>
                  <Icon name="info" size="s" />
                  {t("licenses.reviewNote")}
                </p>
                <ReviewBox compact agentId={l.agentId} slug={a.slug} onSaved={() => setReviewing(null)} onCancel={() => setReviewing(null)} />
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
