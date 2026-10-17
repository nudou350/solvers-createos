// Display of prices. Money travels as integer USD cents (Stripe's unit); formatting is done by Intl from the integer,
// so no float rounding is involved. Pure, no React.

/** Cents (integer number, bigint or integer string) -> number of cents; null when it is not an integer amount. */
export function toCents(cents: number | bigint | string | null | undefined): number | null {
  if (typeof cents === "number") return Number.isSafeInteger(cents) ? cents : null;
  if (typeof cents === "bigint") return Number(cents);
  if (typeof cents === "string" && /^-?\d+$/.test(cents.trim())) return Number(cents.trim());
  return null;
}

/** 2499 -> "$24.99" (en-US) / "US$ 24,99" (pt-BR). `round` drops the cents (cards). Null for an invalid amount. */
export function formatUsd(cents: number | bigint | string | null | undefined, intlLocale: string, opts: { round?: boolean } = {}): string | null {
  const c = toCents(cents);
  if (c === null) return null;
  const whole = c % 100 === 0;
  const digits = opts.round || whole ? 0 : 2;
  return new Intl.NumberFormat(intlLocale, { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    opts.round ? Math.round(c / 100) : c / 100,
  );
}
