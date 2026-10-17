import { createHash } from "node:crypto";

// Pure rules of the e-mail magic link (no env/database), tested in test/magic-link.test.ts.

export const LOGIN_TOKEN_TTL_MS = 15 * 60_000;

/** Hash stored in login_tokens (the token itself only travels in the e-mailed link). */
export const hashLoginToken = (token: string): string => createHash("sha256").update(`solvers-login:${token}`).digest("hex");

/**
 * Where to land after login: only a same-site path ("/library", "/connect?req=..."). Anything else (absolute URLs,
 * protocol-relative "//host", backslashes, control characters) falls back to "/" so the link cannot redirect off-site.
 */
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > 2000) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f\u007f]/.test(raw)) return "/";
  return raw;
}

/** The link e-mailed to the person: it goes through the web origin (which proxies /api) so the cookie lands there. */
export function magicLinkUrl(webUrl: string, token: string, next?: string): string {
  const url = new URL("/api/auth/verify", webUrl);
  url.searchParams.set("token", token);
  const path = safeNextPath(next);
  if (path !== "/") url.searchParams.set("next", path);
  return url.toString();
}

/** Absolute URL on the web app for a (validated) path. */
export function webUrlFor(webUrl: string, path: string): string {
  return new URL(safeNextPath(path), webUrl).toString();
}
