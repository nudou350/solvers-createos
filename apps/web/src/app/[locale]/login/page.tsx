import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginView } from "@/components/auth/LoginView";
import { param } from "@/components/checkout/rules";
import { safeNext } from "@/components/auth/next-path";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common.login" });
  return { title: t("metaTitle"), robots: { index: false } };
}

/** /login?next=<path>: email sign-in link; `next` is where the person lands once signed in. */
export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const sp = await searchParams;
  return <LoginView next={safeNext(param(sp.next))} />;
}
