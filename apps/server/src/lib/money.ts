// Money is integer USD cents everywhere (prices, ledger, Stripe amounts); dollars appear only at the display edge.

/** Cents -> dollars as a number (display fields). */
export const centsToDollars = (cents: number | bigint): number => Number(cents) / 100;

/** Dollars (a human amount) -> integer cents, rounded to the nearest cent. */
export const dollarsToCents = (dollars: number): number => Math.round(dollars * 100);

/** Amount for messages: "$12.50". */
export const formatCents = (cents: number | bigint): string => `$${centsToDollars(cents).toFixed(2)}`;
