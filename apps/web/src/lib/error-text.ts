"use client";
// Error text in the page language. The mapping itself is pure and lives in lib/error-map.ts (`errorText(e, t)`,
// `errorInfo(e, t)`); these hooks bind it to the page's "errors" translator.
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { errorInfo, errorText, type ErrorInfo, type ErrorsT } from "./error-map";

export { ClientError, errorInfo, errorText, type ErrorAction, type ErrorInfo, type ErrorsT } from "./error-map";

/** `const errorText = useErrorText(); toast({ text: errorText(e) })`: one line in the page language. */
export function useErrorText(): (e: unknown) => string {
  const t = useTranslations("errors") as unknown as ErrorsT;
  return useCallback((e: unknown) => errorText(e, t), [t]);
}

/** `const info = useErrorInfo(); info(e)` -> title, text and the suggested action (login, retry). */
export function useErrorInfo(): (e: unknown) => ErrorInfo {
  const t = useTranslations("errors") as unknown as ErrorsT;
  return useCallback((e: unknown) => errorInfo(e, t), [t]);
}
