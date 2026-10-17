import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { AgentMissing } from "@/components/checkout/AgentMissing";
import { CheckoutView } from "@/components/checkout/CheckoutView";
import { loadAgent } from "@/components/checkout/loadAgent";
import { param } from "@/components/checkout/rules";
import { Button } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";

export async function generateMetadata({ params }: PageProps<"/[locale]/checkout">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("meta.title"), robots: { index: false } };
}

// The price is read on every request (the server charges its own price anyway).
export const dynamic = "force-dynamic";

/** /checkout?agent=<slug> */
export default async function CheckoutPage({ searchParams }: PageProps<"/[locale]/checkout">) {
  const sp = await searchParams;
  const { detail, error } = await loadAgent(param(sp.agent));
  if (!detail) return <AgentMissing error={error} />;
  // A platform Solver is free and has no license: there is nothing to buy.
  if (detail.agent.platform) return <PlatformFree slug={detail.agent.slug} name={detail.agent.name} />;
  return <CheckoutView key={detail.agent.id} detail={detail} />;
}

function PlatformFree({ slug, name }: { slug: string; name: string }) {
  const t = useTranslations("checkout.platformFree");
  return (
    <section className="wrap" style={{ paddingTop: 56, paddingBottom: 72 }}>
      <Empty icon="gift" title={t("title", { name })} action={<Button href={`/install?agent=${encodeURIComponent(slug)}`} iconRight="arrow-right">{t("action")}</Button>}>
        {t("text")}
      </Empty>
    </section>
  );
}
