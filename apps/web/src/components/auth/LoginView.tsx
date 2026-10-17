"use client";
// Email sign-in: `POST /api/auth/email` sends a one-time link; opening it sets the `solvers_session` cookie and the
// session provider brings the person back to `next`. With DEV_LOGIN the API returns the link instead of emailing it, and
// it is shown as a "Continue" button.
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Loading } from "@/components/ui/Spinner";
import { Notice } from "@/components/ui/Toast";
import { useErrorText } from "@/lib/error-text";
import { api } from "@/lib/api";
import { rememberNext, useSession } from "@/lib/session";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A dev link is followed only when it is an http(s) URL. */
function safeLink(link: string | null): string | null {
  if (!link) return null;
  try {
    const u = new URL(link, window.location.origin);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function LoginView({ next, invalidLink = false }: { next: string; invalidLink?: boolean }) {
  const t = useTranslations("common.login");
  const errorText = useErrorText();
  const { status, me } = useSession();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Already signed in (e.g. came back with the link in another tab): go on.
  useEffect(() => {
    if (status === "signed-in") window.location.replace(next);
  }, [status, next]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL.test(value)) {
      setError(t("invalidEmail"));
      return;
    }
    setSending(true);
    setError(null);
    try {
      rememberNext(next);
      const r = await api.authEmail(value);
      setSentTo(value);
      setDevLink(safeLink(r.devLink ?? null));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="wrap" style={{ paddingTop: 48, paddingBottom: 64, maxWidth: 520 }}>
      <Card pad="l">
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Icon name="user" size="l" />
            <h1 style={{ margin: 0, fontSize: 24 }}>{t("title")}</h1>
          </div>

          {status === "loading" ? <Loading /> : null}

          {status === "signed-in" && me ? (
            <>
              <p style={{ margin: 0 }}>{t("signedInAs", { email: me.email })}</p>
              {/* Plain links: `next` already carries the locale prefix. */}
              <a className={buttonClass({ block: true })} href={next}>
                {t("goOn")}
              </a>
            </>
          ) : null}

          {/* The verify route sends an expired or already used link back here with ?error=invalid_link. */}
          {status === "signed-out" && !sentTo && invalidLink ? (
            <Notice tone="warn" title={t("invalidLinkTitle")}>
              {t("invalidLinkText")}
            </Notice>
          ) : null}

          {status === "signed-out" && !sentTo ? (
            <form onSubmit={submit} style={{ display: "grid", gap: 14 }} noValidate>
              <p style={{ margin: 0 }}>{t("intro")}</p>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="small">{t("emailLabel")}</span>
                <input
                  className="input"
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  autoFocus
                  placeholder={t("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!error}
                />
              </label>
              <Button block type="submit" loading={sending}>
                {sending ? t("sending") : t("submit")}
              </Button>
              <p className="tiny faint" style={{ margin: 0 }}>
                {t("terms")}
              </p>
            </form>
          ) : null}

          {status === "signed-out" && sentTo ? (
            <>
              {devLink ? (
                <Notice tone="info" title={t("devTitle")}>
                  {t("devText")}
                </Notice>
              ) : (
                <Notice tone="ok" title={t("sentTitle")}>
                  {t("sentText", { email: sentTo })}
                </Notice>
              )}
              {devLink ? (
                <a className={buttonClass({ block: true })} href={devLink}>
                  {t("continue")}
                  <Icon name="arrow-right" size="s" />
                </a>
              ) : null}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setSentTo(null);
                  setDevLink(null);
                }}
              >
                {t("useAnother")}
              </button>
            </>
          ) : null}

          {error ? (
            <Notice tone="bad" title={t("failed")} role="alert">
              {error}
            </Notice>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
