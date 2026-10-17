"use client";
// Connector consent (OAuth): Claude/ChatGPT opens /oauth/authorize, the server stores the request and redirects here.
// The person must be signed in (signed out: /login first, then back here); authorizing posts the request id with the
// session cookie and we return to the assistant with the authorization code.
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Loading } from "@/components/ui/Spinner";
import { Notice } from "@/components/ui/Toast";
import { API_BASE } from "@/lib/api";
import { useErrorText } from "@/lib/error-text";
import { useSession } from "@/lib/session";
import { displayNameOf } from "@/components/layout/Header";
import { SwitchAccount } from "@/components/layout/SwitchAccount";

type Info = { clientName: string; redirectHost: string; verified: boolean };

/** Error of /oauth/authorize/*: keeps the RFC 6749 code and the server's English description, translated on screen. */
class OAuthFailure extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function getJson<T>(url: string, fallback: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, { credentials: "include", ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; error_description?: string };
  if (!res.ok) throw new OAuthFailure(body.error_description ?? body.error ?? fallback, body.error, res.status);
  return body;
}

export function ConnectView({ req }: { req: string | null }) {
  const { status, me, signIn } = useSession();
  const errorText = useErrorText();
  const t = useTranslations("connect");
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(req ? null : t("invalidRequest"));
  const [step, setStep] = useState<string | null>(null);
  // Fallback text in a ref: `t` changes identity on every render and must not restart the loading effect.
  const genericError = useRef(t("genericError"));
  genericError.current = t("genericError");
  // Known server messages (English) become text in the page language; anything else goes through the app's error text.
  const localize = (e: Error) => {
    if (!(e instanceof OAuthFailure)) return errorText(e);
    if (e.code === "too_many_requests") return t("errTooMany");
    if (e.code === "login_required" || e.code === "unauthorized") return t("errSignedOut");
    if (e.code === "invalid_request") return /expired/i.test(e.message) ? t("errExpired") : t("invalidRequest");
    return e.message;
  };

  useEffect(() => {
    if (!req) return;
    let alive = true;
    getJson<Info>(`/oauth/authorize/info?req=${encodeURIComponent(req)}`, genericError.current)
      .then((i) => alive && setInfo(i))
      .catch((e: Error) => alive && setError(localize(e)));
    return () => {
      alive = false;
    };
  }, [req]); // eslint-disable-line react-hooks/exhaustive-deps

  // Consent needs a session: signed out, sign in first and come back to this same request.
  useEffect(() => {
    if (req && status === "signed-out") signIn();
  }, [req, status, signIn]);

  async function authorize() {
    if (!req || !info || !me) return;
    setError(null);
    try {
      setStep(t("stepConnecting"));
      const done = await getJson<{ redirectTo: string }>("/oauth/authorize/complete", t("genericError"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ req }),
      });
      setStep(t("stepDone", { client: info.clientName }));
      window.location.href = done.redirectTo;
    } catch (e) {
      setStep(null);
      // The session ended meanwhile: sign in again and come back to this same request.
      if (e instanceof OAuthFailure && e.status === 401) return signIn();
      setError(localize(e as Error) || t("somethingWrong"));
    }
  }

  return (
    <section className="wrap" style={{ paddingTop: 48, paddingBottom: 64, maxWidth: 560 }}>
      <Card pad="l">
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Icon name="shield-check" size="l" />
            <h1 style={{ margin: 0, fontSize: 24 }}>{t("title")}</h1>
          </div>

          {!info && !error ? <Loading text={t("loadingRequest")} /> : null}

          {info ? (
            <>
              <p style={{ margin: 0 }}>{t.rich("intro", { client: info.clientName, b: (c) => <strong>{c}</strong> })}</p>
              <p style={{ margin: 0, fontSize: 14 }}>
                {t("returnsTo")} <code>{info.redirectHost}</code> {info.verified ? t("verified") : null}
              </p>
              {!info.verified ? (
                <Notice tone="warn" title={t("unverifiedTitle")}>
                  {t("unverifiedBody")}
                </Notice>
              ) : null}

              {status !== "signed-in" ? <Loading text={status === "signed-out" ? t("toSignIn") : undefined} /> : null}

              {status === "signed-in" && me ? (
                <>
                  <p style={{ margin: 0 }}>
                    {t("connectingAs")} <strong>{displayNameOf(me)}</strong> <span className="small muted">({me.email})</span>{" "}
                    <SwitchAccount disabled={!!step} label={t("switchAccount")} />
                  </p>
                  <Button block loading={!!step} onClick={authorize}>
                    {t("authorize", { client: info.clientName })}
                  </Button>
                </>
              ) : null}

              <div role="status" aria-live="polite" style={{ minHeight: 20, fontSize: 14 }}>
                {step}
              </div>
            </>
          ) : null}

          {error ? (
            <Notice tone="bad" title={t("failedTitle")} role="alert">
              {error}
            </Notice>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
