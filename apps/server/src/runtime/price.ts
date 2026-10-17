// Prices are integer USD cents everywhere (DB `agents.price_cents`, manifest `pricing.priceCents`, API `priceCents`).
// The rules live in @solvers/shared so the web formats prices the same way.
export { MIN_PRICE_CENTS, formatCents } from "@solvers/shared";
