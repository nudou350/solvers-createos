// Friendly text for any error the web shows: API errors (`ApiError.code` -> errors.api.<code>, or a titled notice in
// errors.notice.<id>), network failures and text the app already wrote for the person. Pure (no React, no next-intl
// import): the caller passes the translator of the "errors" namespace, so this file is unit-tested (test/unit.test.ts).
import { ApiError } from "@solvers/api-client";

/** Translator of the "errors" namespace (next-intl `useTranslations("errors")` or lib/local-text). */
export type ErrorsT = ((key: string, values?: Record<string, string | number>) => string) & { has: (key: string) => boolean };

export type ErrorAction = "login" | "retry" | null;

export type ErrorInfo = {
  /** API code or a client kind (network, unknown...). */
  code: string;
  title: string;
  text: string;
  /** Action the screen may offer: sign in again or retry. */
  action: ErrorAction;
};

/** Client-side failure with a known code. */
export class ClientError extends Error {
  constructor(
    readonly code: string,
    message?: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message ?? code);
  }
}

/**
 * An error whose message is already written for the person, in the page language. It is the only kind of plain error
 * shown verbatim; any other unexpected error shows the generic localized text.
 */
export class UserFacingError extends Error {}

/** API codes with their own titled notice (errors.notice.<code>). */
const TITLED = new Set(["license_already_reviewed", "submission_state", "not_approved", "wrong_step"]);

export function errorInfo(e: unknown, t: ErrorsT): ErrorInfo {
  const notice = (code: string, id: string, action: ErrorAction = null): ErrorInfo => ({
    code,
    title: t(`notice.${id}.title`),
    text: t(`notice.${id}.text`),
    action,
  });
  const withText = (code: string, id: string, text: string, action: ErrorAction = null): ErrorInfo => ({ code, title: t(`notice.${id}.title`), text, action });
  const apiText = (err: ApiError) => (err.code && t.has(`api.${err.code}`) ? t(`api.${err.code}`) : err.message || t("generic"));

  if (e instanceof ApiError) {
    if (TITLED.has(e.code)) return notice(e.code, e.code);
    if (e.code === "rate_limited" || e.status === 429) return notice(e.code, "rate_limited", "retry");
    if (e.code === "unauthorized" || e.status === 401) return notice(e.code, "unauthorized", "login");
    if (e.status >= 500) return notice(e.code, "server_error", "retry");
    if (e.status === 0) return notice("network", "offline", "retry");
    return withText(e.code, "bad_request", apiText(e));
  }

  if (e instanceof ClientError && t.has(`notice.${e.code}.title`)) return notice(e.code, e.code, "retry");

  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return notice("network", "offline", "retry");
  // Text the app wrote for the person (already translated) is shown as is. Anything else (library errors, plain English
  // `Error`s) shows the generic localized text; the raw error stays in the console for debugging.
  if (e instanceof UserFacingError && msg) return { code: "unknown", title: t("notice.unknown.title"), text: msg, action: "retry" };
  console.error("[solvers] unexpected error", e);
  return { code: "unknown", title: t("notice.unknown.title"), text: t("notice.unknown.text"), action: "retry" };
}

/** One line of text for a toast or an inline error. */
export function errorText(e: unknown, t: ErrorsT): string {
  return errorInfo(e, t).text;
}
