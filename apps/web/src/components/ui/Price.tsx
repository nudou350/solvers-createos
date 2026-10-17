"use client";
import { useLocale } from "next-intl";
import { INTL_LOCALE, type Locale } from "@/i18n/routing";
import { formatUsd } from "@/lib/format-money";

export type PriceProps = {
  /** Amount in integer USD cents, e.g. 2499 for $24.99. */
  cents: number;
  size?: "s" | "m" | "l" | "xl";
  /** Without cents (cards). */
  round?: boolean;
  /** Text after the amount, e.g. "one-time". */
  suffix?: string;
  className?: string;
  /** Kept for layout compatibility: the price is a single line. */
  inline?: boolean;
};

/** Price in US dollars, formatted in the page language. */
export function Price({ cents, size = "m", round, suffix, inline, className }: PriceProps) {
  const locale = useLocale() as Locale;
  const text = formatUsd(cents, INTL_LOCALE[locale], { round });
  const cls = ["price", `price-${size}`, inline ? "inline" : "", className ?? ""].filter(Boolean).join(" ");
  if (text === null) return <span className={cls} aria-busy="true" />;
  return (
    <span className={cls}>
      <span className="price-main">{text}</span>
      {suffix ? <span className="price-sub">{suffix}</span> : null}
    </span>
  );
}
