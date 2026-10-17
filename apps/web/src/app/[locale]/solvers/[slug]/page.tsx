import type { AgentDetail } from "@solvers/api-client";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache, type CSSProperties } from "react";
import { BeforeAfterBlock, Reviews, Scores, Versions } from "@/components/catalog/AgentSections";
import { AutoBuy } from "@/components/catalog/AutoBuy";
import { BuyBox } from "@/components/catalog/BuyBox";
import { DifferentiatorBadges } from "@/components/catalog/PlatformBits";
import { Gallery } from "@/components/catalog/Gallery";
import { ClampedText } from "@/components/ui/ClampedText";
import { TrialBlock } from "@/components/catalog/TrialBlock";
import { creatorHref } from "@/components/catalog/data";
import { Button } from "@/components/ui/Button";
import { RepBadge } from "@/components/ui/Chip";
import { Empty } from "@/components/ui/Empty";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Tile } from "@/components/ui/Tile";
import { ApiError, serverApi } from "@/lib/api";
import { initials } from "@/lib/format";
import { getFormat } from "@/lib/format-server";
import { DIFFERENTIATORS, knownDifferentiators } from "@/lib/differentiators";
import { gap } from "@/lib/style";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Detail, fetched once per request (metadata and page). null = not found. */
const load = cache(async (slug: string, lang: Locale): Promise<{ d: AgentDetail } | null> => {
  try {
    return { d: await serverApi().getAgent(slug, lang) };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
});

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { slug, locale } = await params;
  const data = await load(slug, locale as Locale).catch(() => null);
  if (!data) return { title: (await getTranslations({ locale, namespace: "catalog.meta" }))("solverFallback") };
  return { title: data.d.agent.name, description: data.d.agent.tagline };
}

const PACK: { icon: IconName; hue: number }[] = [
  { icon: "book", hue: 250 },
  { icon: "wrench", hue: 300 },
  { icon: "file", hue: 60 },
  { icon: "refresh", hue: 150 },
  { icon: "message", hue: 25 },
];

/** Columns of "What's in the package": up to 5 in one row; above that, full rows of 3 or 4. */
const packCols = (n: number) => (n <= 5 ? Math.max(2, n) : n % 3 === 0 ? 3 : 4);

export default async function AgentPage({ params, searchParams }: Props) {
  const { slug, locale } = await params;
  // ?buy=1: back from the sign-in page in the middle of a purchase; the checkout opens on load.
  const resumeBuy = (await searchParams).buy === "1";
  const t = await getTranslations("catalog.page");
  const tc = await getTranslations("catalog");
  const f = await getFormat();
  let data: Awaited<ReturnType<typeof load>>;
  try {
    data = await load(slug, locale as Locale);
  } catch {
    return (
      <section className="wrap sec">
        <Empty icon="warning" title={t("loadErrorTitle")} action={<Button href={`/solvers/${encodeURIComponent(slug)}`}>{t("retry")}</Button>}>
          {t("loadErrorBody")}
        </Empty>
      </section>
    );
  }
  if (!data) notFound();

  const { d } = data;
  const a = d.agent;
  const cr = d.creator;
  const lv = f.repLevel(cr.reputationScore);
  const req = (t: "client" | "connector" | "plan") => a.requirements.filter((r) => r.type === t);
  const clients = req("client").map((r) => r.label);
  const connectors = req("connector");
  const plan = req("plan")[0]?.label ?? null;
  const diffs = knownDifferentiators(a.differentiators);
  const catName = f.categoryLabel(a.category);
  const clientList = new Intl.ListFormat(f.locale === "pt" ? "pt-BR" : "en-US", { type: "conjunction" }).format(clients);

  return (
    <>
      <div className="wrap" style={{ paddingTop: 28 }}>
        <nav className="crumbs" aria-label={t("crumbsAria")}>
          <Link href="/">{t("home")}</Link>
          <Icon name="chevron-right" size="s" />
          <Link href="/#categorias">{catName}</Link>
          <Icon name="chevron-right" size="s" />
          <span style={{ color: "var(--ink)" }} aria-current="page">
            {a.name}
          </span>
        </nav>
      </div>

      <section className="wrap" style={{ paddingTop: 28, paddingBottom: 56 }}>
        <div className="split">
          <div className="col" style={gap("26px")}>
            <div className="row start m-col-x" style={gap("22px")}>
              <Tile category={a.category} size="l" />
              <div className="col grow" style={gap("10px")}>
                <div className="row wrapx" style={gap("8px")}>
                  <span className="chip">{catName}</span>
                  <span className="chip">{t("version", { version: a.version })}</span>
                </div>
                <h1 className="display h1s">{a.name}</h1>
                <p className="lead">{a.tagline}</p>
                <DifferentiatorBadges keys={a.differentiators} />
              </div>
            </div>
            <div className="row wrapx card pad-s" style={gap("14px", { padding: "14px 18px" })}>
              <span className="av" aria-hidden>
                {initials(cr.name)}
              </span>
              <div className="grow" style={{ minWidth: 180 }}>
                <div className="small faint">{t("createdBy")}</div>
                <Link className="bold trunc" style={{ display: "block" }} href={creatorHref(cr.id)}>
                  {cr.name}
                </Link>
              </div>
              <RepBadge score={cr.reputationScore}>
                <span>
                  {t("repBadge", { level: lv.label, score: cr.reputationScore })}
                </span>
              </RepBadge>
            </div>
            <Gallery images={d.images} name={a.name} />
            <ClampedText text={a.description} style={{ fontSize: 17, lineHeight: 1.65 }} />
            <div className="row wrapx" style={gap("10px")}>
              {clients.length ? (
                <span className="chip chip-plain">
                  <Icon name="monitor" size="s" />
                  {t("worksOn", { clients: clientList })}
                </span>
              ) : null}
              {connectors.map((r) => (
                <span key={r.label} className="chip chip-plain">
                  <Icon name="plug" size="s" />
                  {r.optional ? t("connectorOptional", { name: f.connectorName(r.label) }) : t("connector", { name: r.label })}
                </span>
              ))}
              {plan ? (
                <span className="chip chip-plain">
                  <Icon name="card" size="s" />
                  {plan}
                </span>
              ) : null}
            </div>
          </div>

          <aside className="sticky" aria-label={a.platform ? t("asideInstall") : t("asideBuy")}>
            <BuyBox platform={a.platform} slug={a.slug} name={a.name} priceCents={a.priceCents} trial={d.trial} />
            {resumeBuy && !a.platform ? <AutoBuy slug={a.slug} /> : null}
          </aside>
        </div>
      </section>

      {d.trial ? <TrialBlock slug={a.slug} trial={d.trial} /> : null}

      <Scores
        rating={a.userRating}
        reviewsCount={a.reviewsCount}
        distribution={d.ratingDistribution}
        evalScore={a.evalScore}
        version={a.version}
        verifiedUses={a.verifiedUses}
        tech={{ hash: a.versionHash, packageId: a.id }}
      />

      <BeforeAfterBlock items={d.beforeAfter} name={a.name} />

      {diffs.length ? (
        <section className="wrap" style={{ paddingBottom: 64 }} aria-labelledby="diferenciais">
          <div className="col" style={gap("8px", { marginBottom: 26 })}>
            <h2 className="display h2s" id="diferenciais">
              {t("diffTitle")}
            </h2>
            <p className="muted" style={{ maxWidth: 620 }}>
              {t("diffBody")}
            </p>
          </div>
          <ul className={`g${Math.min(3, Math.max(2, diffs.length))} m1`} style={gap("16px")}>
            {diffs.map((k) => (
              <li key={k} className="card pad-s col" style={gap("10px")}>
                <span className="tile tile-s" style={{ "--h": 250 } as CSSProperties} aria-hidden>
                  <Icon name={DIFFERENTIATORS[k]?.icon ?? "check"} />
                </span>
                <b>{tc(`diff.${k}.label`)}</b>
                <span className="small muted">{tc(`diff.${k}.text`)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="wrap" style={{ paddingBottom: 64 }}>
        <div className="col" style={gap("8px", { marginBottom: 26 })}>
          <h2 className="display h2s">{t("reqTitle")}</h2>
          <p className="muted" style={{ maxWidth: 620 }}>
            {t("reqBody", { kind: a.platform ? "install" : "buy" })}
          </p>
        </div>
        <div className="g3" style={gap("22px")}>
          <div className="card pad col" style={gap("14px")}>
            <div className="row" style={gap("12px")}>
              <span className="tile tile-s" style={{ "--h": 250 } as CSSProperties} aria-hidden>
                <Icon name="monitor" />
              </span>
              <h3 className="h4">{t("compatTitle")}</h3>
            </div>
            {clients.map((k) => (
              <div key={k} className="row" style={gap("10px")}>
                <span className="ok">
                  <Icon name="check-circle" />
                </span>
                <b>{k}</b>
              </div>
            ))}
            <p className="small muted">{t("compatNote")}</p>
          </div>
          <div className="card pad col" style={gap("14px")}>
            <div className="row" style={gap("12px")}>
              <span className="tile tile-s" style={{ "--h": 300 } as CSSProperties} aria-hidden>
                <Icon name="plug" />
              </span>
              <h3 className="h4">{t("connectorsTitle")}</h3>
            </div>
            {connectors.length ? (
              connectors.map((r) => (
                <div key={r.label} className="col" style={gap("6px")}>
                  <div className="row between" style={gap("12px")}>
                    <b className="grow">{f.connectorName(r.label)}</b>
                    {r.optional ? <span className="chip">{t("optional")}</span> : <span className="chip chip-warn">{t("connectNow")}</span>}
                  </div>
                  {r.howTo ? <p className="small muted" style={{ overflowWrap: "anywhere" }}>{r.howTo}</p> : null}
                  {r.helpUrl ? (
                    <a className="link small" href={r.helpUrl} target="_blank" rel="noopener noreferrer">
                      {t("officialHelp")}
                    </a>
                  ) : null}
                </div>
              ))
            ) : (
              <b>{t("none")}</b>
            )}
            <p className="small muted">
              {connectors.length ? t("connectorsNote") : t("noConnectorsNote")}
            </p>
          </div>
          <div className="card pad col" style={gap("14px")}>
            <div className="row" style={gap("12px")}>
              <span className="tile tile-s" style={{ "--h": 150 } as CSSProperties} aria-hidden>
                <Icon name="card" />
              </span>
              <h3 className="h4">{t("planTitle")}</h3>
            </div>
            <b>{plan ?? t("anyPlan")}</b>
            <p className="small muted">{plan ? t("planByCreator") : t("planNone")} {t("planNote")}</p>
          </div>
        </div>
      </section>

      {a.packageContents.length ? (
        <section className="wrap" style={{ paddingBottom: 64 }}>
          <div className="col" style={gap("8px", { marginBottom: 26 })}>
            <h2 className="display h2s">{t("packageTitle")}</h2>
          </div>
          <div className={`g${packCols(a.packageContents.length)} m1`} style={gap("16px")}>
            {a.packageContents.map((t, i) => {
              const s = PACK[i % PACK.length] ?? PACK[0]!;
              return (
                <div key={t} className="card pad-s col" style={gap("12px")}>
                  <span className="tile tile-s" style={{ "--h": s.hue } as CSSProperties} aria-hidden>
                    <Icon name={s.icon} />
                  </span>
                  <p className="small">{t}</p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {d.versions.length ? (
        <section className="wrap" style={{ paddingBottom: 64 }}>
          <div className="row between end wrapx" style={gap("12px", { marginBottom: 26 })}>
            <h2 className="display h2s">{t("versionsTitle")}</h2>
            <span className="small muted">{t("versionsNote")}</span>
          </div>
          <Versions versions={d.versions} />
        </section>
      ) : null}

      <section id="avaliar" className="wrap" style={{ paddingBottom: 24, scrollMarginTop: 24 }}>
        <div className="row between end wrapx" style={gap("12px", { marginBottom: 26 })}>
          <h2 className="display h2s">{t("reviewsTitle")}</h2>
          <span className="verified">
            <Icon name="shield-check" size="s" />
            {t("allVerified")}
          </span>
        </div>
        <Reviews slug={a.slug} initial={d.reviews} total={Math.max(a.reviewsCount, d.reviews.length)} />
      </section>
    </>
  );
}
