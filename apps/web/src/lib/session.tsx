"use client";
// Session of the web app: the server keeps it in the httpOnly `solvers_session` cookie, opened by the email sign-in
// link (/login -> `POST /api/auth/email` -> link -> cookie). This provider reads it from `GET /api/auth/me`.
// `useSession()` in signed-in screens; `signIn()` sends the person to /login, and once the link opens the session the
// person lands back on the page they came from (`rememberNext` / `takeNext`).
import type { PublicConfig } from "@solvers/api-client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, onUnauthorized, type SolversApi } from "./api";
import { usePublicConfig } from "./config";

export type SessionStatus = "loading" | "signed-out" | "signed-in";

/** The signed-in person: user id and email, plus the display name from the profile. */
export type Me = { id: string; email: string; displayName: string | null };

export type Session = {
  status: SessionStatus;
  /** User id (uuid) of the session, or null when signed out. */
  userId: string | null;
  /** Goes to the sign-in page; after the email link the person comes back to `next` (default: the current page). */
  signIn(next?: string): void;
  /** Ends the server session. */
  signOut(): Promise<void>;
  /** The signed-in person (null while loading or signed out). */
  me: Me | null;
  /** Re-reads /api/me and the profile (e.g. after editing the name). */
  refresh(): Promise<Me | null>;
  /** The API client (same instance as lib/api). */
  api: SolversApi;
  /** Public config (`GET /api/config`), null while it loads. Same as `usePublicConfig()`. */
  config: PublicConfig | null;
};

const Ctx = createContext<Session | null>(null);

/** Path of the sign-in page for this locale, returning to `next` (a same-site path). */
export function loginHref(next: string, localePrefix = ""): string {
  return `${localePrefix}/login?${new URLSearchParams({ next })}`;
}

/** Locale prefix of the current page ("/pt" or ""), for links built outside next-intl's router. */
function currentPrefix(): string {
  return /^\/pt(\/|$)/.test(window.location.pathname) ? "/pt" : "";
}

// Page to return to after the email link. The link may open on any page the server chooses (and in another tab), so
// /login keeps `next` in this browser and the provider goes there once the session exists. Expires with the link.
const NEXT_KEY = "solvers.login.next";
const NEXT_TTL_MS = 30 * 60_000;

/** Called by /login when the link is sent. */
export function rememberNext(next: string) {
  try {
    localStorage.setItem(NEXT_KEY, JSON.stringify({ next, at: Date.now() }));
  } catch {
    // no storage: the person lands where the link points
  }
}

/** The remembered page (same-site path, not expired), removed once read. */
function takeNext(): string | null {
  try {
    const raw = localStorage.getItem(NEXT_KEY);
    if (!raw) return null;
    localStorage.removeItem(NEXT_KEY);
    const { next, at } = JSON.parse(raw) as { next?: unknown; at?: unknown };
    if (typeof next !== "string" || typeof at !== "number" || Date.now() - at > NEXT_TTL_MS) return null;
    return next.startsWith("/") && !next.startsWith("//") ? next : null;
  } catch {
    return null;
  }
}

async function fetchMe(): Promise<Me | null> {
  try {
    const me = await api.me();
    const profile = await api.getProfile().catch(() => null);
    return { id: me.userId, email: me.email, displayName: profile?.displayName ?? null };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const config = usePublicConfig();
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [me, setMe] = useState<Me | null>(null);

  const refresh = useCallback(async () => {
    try {
      const m = await fetchMe();
      setMe(m);
      setStatus(m ? "signed-in" : "signed-out");
      return m;
    } catch {
      setStatus((s) => (s === "loading" ? "signed-out" : s));
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh().then((m) => {
      // Signed in by the email link: back to the page the person was on before /login.
      if (!m) return;
      const next = takeNext();
      const here = `${window.location.pathname}${window.location.search}`;
      if (next && next !== here) window.location.replace(next);
    });
  }, [refresh]);

  // 401 in the middle of a session (cookie expired): re-read it; the status becomes "signed-out" and screens ask to sign in.
  const statusRef = useRef(status);
  statusRef.current = status;
  const rechecking = useRef(false);
  useEffect(
    () =>
      onUnauthorized(() => {
        if (statusRef.current !== "signed-in" || rechecking.current) return;
        rechecking.current = true;
        void refresh().finally(() => {
          rechecking.current = false;
        });
      }),
    [refresh],
  );

  const signIn = useCallback((next?: string) => {
    const here = `${window.location.pathname}${window.location.search}`;
    // The prefix of /login follows the current page; `next` keeps its own prefix.
    window.location.assign(loginHref(next ?? here, currentPrefix()));
  }, []);

  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setMe(null);
    setStatus("signed-out");
  }, []);

  const value = useMemo<Session>(
    () => ({ status, userId: me?.id ?? null, signIn, signOut, me, refresh, api, config }),
    [status, me, signIn, signOut, refresh, config],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession must be used inside <SessionProvider>");
  return s;
}
