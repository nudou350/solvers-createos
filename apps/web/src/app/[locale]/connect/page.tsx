import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConnectView } from "@/components/connect/ConnectView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("connect.meta");
  return { title: t("title"), robots: { index: false } };
}

// Target of the server's /oauth/authorize: the connector consent screen.
export default async function ConnectPage({ searchParams }: PageProps<"/[locale]/connect">) {
  const req = (await searchParams).req;
  // The server signs the pending request as a JWT (base64url parts joined by dots); it verifies it on approval.
  const id = typeof req === "string" && /^[A-Za-z0-9_.-]{8,4000}$/.test(req) ? req : null;
  return <ConnectView req={id} />;
}
