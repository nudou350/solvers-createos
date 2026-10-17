// Money: integer USD cents end to end (Stripe's `unit_amount`, `payment_ledger.amount_cents`). No float math on
// amounts: numbers with decimals only appear at the display edge (`centsToDollars`, `formatCents`) and when reading
// human-entered prices (`dollarsToCents`, `parseDollars`).

/** Basis-point denominator. */
export const MAX_BPS = 10_000;
/** Platform fee on every sale (10%); the creator gets the rest, including the rounding remainder. */
export const PLATFORM_FEE_BPS = 1_000;
/** Minimum price of a Solver license, in cents (US$ 5). */
export const MIN_PRICE_CENTS = 500;
/** Currency of every price and charge (Stripe lowercase code). */
export const CURRENCY = "usd";

function assertBps(name: string, bps: number, max = MAX_BPS): void {
  if (!Number.isInteger(bps) || bps < 0 || bps > max) throw new RangeError(`invalid ${name}: ${bps} (expected an integer in 0..${max})`);
}

function assertCents(name: string, cents: number): void {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError(`invalid ${name}: ${String(cents)} (expected a non-negative integer of cents)`);
}

/** True for a valid amount of cents: a non-negative safe integer. */
export function isCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Sale split: `fee = amount × bps / 10_000` (floor), `rest = amount − fee` (the rounding remainder goes to the
 * creator). Default fee: `PLATFORM_FEE_BPS` (10%).
 */
export function feeSplit(amountCents: number, feeBps: number = PLATFORM_FEE_BPS): { fee: number; rest: number } {
  assertCents("amountCents", amountCents);
  assertBps("feeBps", feeBps);
  const fee = Math.floor((amountCents * feeBps) / MAX_BPS);
  return { fee, rest: amountCents - fee };
}

// ----- Conversion and display -----

const DECIMAL_RE = /^(\d+)(?:\.(\d+))?$/;

/**
 * Exact decimal string of dollars -> cents (`"12.5"` -> `1250`). Rejects signs, exponents and more than 2 fractional
 * digits (unless the extra digits are zeros): money is never rounded silently.
 */
export function parseDollars(amount: string): number {
  const m = DECIMAL_RE.exec(amount.trim());
  if (!m) throw new RangeError(`invalid amount: ${JSON.stringify(amount)}`);
  let frac = m[2] ?? "";
  if (frac.length > 2) {
    if (/[^0]/.test(frac.slice(2))) throw new RangeError(`amount ${amount} has more than 2 decimals`);
    frac = frac.slice(0, 2);
  }
  const cents = Number(m[1]!) * 100 + Number(frac.padEnd(2, "0"));
  assertCents("amount", cents);
  return cents;
}

/** Cents -> exact decimal string of dollars without trailing zeros (`1250` -> `"12.5"`, `900` -> `"9"`). */
export function fromCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`invalid cents: ${cents}`);
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const frac = String(abs % 100).padStart(2, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${Math.floor(abs / 100)}${frac ? `.${frac}` : ""}`;
}

/**
 * Human-entered dollars as a JS number -> cents, rounding float noise (`0.1 + 0.2` -> `30`). Throws when the value
 * really has more than 2 decimals (`1.005`).
 */
export function dollarsToCents(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError(`invalid amount: ${amount}`);
  const cents = Math.round(amount * 100);
  if (Math.abs(cents / 100 - amount) > Number.EPSILON * Math.max(1, amount) * 8) {
    throw new RangeError(`${amount} has more than 2 decimal places`);
  }
  assertCents("amount", cents);
  return cents;
}

/** Cents -> dollars as a JS number, for display only. */
export function centsToDollars(cents: number): number {
  return Number(fromCents(cents));
}

/** Cents -> `"$9.00"` (or the locale's form). */
export function formatCents(cents: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(cents / 100);
}
