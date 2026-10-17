"use client";
// Glue between the creator/admin screens and the app foundation (locale, error text). Every foundation call the creator
// area makes goes through this file, so an interface change is fixed in one place.
import { ApiError } from "@solvers/api-client";
import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import { INTL_LOCALE, type Locale } from "@/i18n/routing";
import { useErrorText } from "@/lib/error-text";
import { kpiHeadline } from "./creator-rules";

/** Intl locale of the page ("en-US", "pt-BR"). */
export function useIntlLocale(): string {
  return INTL_LOCALE[useLocale() as Locale];
}

/** Big KPI figure from USD cents ("$1,234", "$0.45"). */
export function useHeadline(): (cents: number) => string {
  const locale = useIntlLocale();
  return useCallback((cents: number) => kpiHeadline(cents, locale), [locale]);
}

/** Error text in the page language: creator-specific codes first (creator.errors.<code>), then the app's text. */
export function useCreatorErrorText(): (e: unknown) => string {
  const appText = useErrorText();
  const tc = useTranslations("creator.errors");
  return useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.code && tc.has(e.code)) return tc(e.code);
      return appText(e);
    },
    [appText, tc],
  );
}
