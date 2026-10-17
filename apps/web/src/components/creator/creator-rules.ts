// Pure rules of the creator screens. No React, no I/O; tested in apps/web/test/creator-rules.test.ts.

/**
 * Big KPI figure from integer USD cents (display only): whole dollars from $10 up, cents below so small revenue never
 * shows as "$0" (45 -> "$0.45").
 */
export function kpiHeadline(cents: number, intlLocale: string): string {
  const dollars = cents / 100;
  const digits = Math.abs(dollars) < 10 && cents !== 0 ? 2 : 0;
  return new Intl.NumberFormat(intlLocale, { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    digits ? dollars : Math.round(dollars),
  );
}
