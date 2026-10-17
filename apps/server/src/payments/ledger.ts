import { and, eq, inArray, lt, sql, type SQL } from "drizzle-orm";

import { db, schema } from "../db/index.js";
import type { Charge, ChargeKind, ChargeStatus, PaymentProviderId } from "./types.js";

// Payment ledger (`payment_ledger`, plan §6.4): one row per charge, written BEFORE any provider call. Amounts are integer
// USD cents. Every status change is a conditional UPDATE (`WHERE status IN (...)`), so concurrent webhooks, the reconcile
// job and a user request can never move the same charge twice.

export type LedgerRow = typeof schema.paymentLedger.$inferSelect;
type LedgerInsert = typeof schema.paymentLedger.$inferInsert;

/**
 * Provider data kept in `provider_payload` (jsonb): the hosted checkout URL, the payment intent id and, once fulfilled,
 * the fee split (`feeCents`, `creatorCents`, `feeBps`; the creator payout comes later with Connect).
 */
export type ProviderPayload = Record<string, unknown>;

export type LedgerPatch = Partial<
  Pick<LedgerInsert, "providerRef" | "error" | "confirmedAt" | "fulfilledAt">
> & { payload?: ProviderPayload };

export async function insertCharge(values: LedgerInsert): Promise<LedgerRow> {
  const [row] = await db.insert(schema.paymentLedger).values(values).returning();
  return row!;
}

export async function loadCharge(id: string): Promise<LedgerRow | undefined> {
  const [row] = await db.select().from(schema.paymentLedger).where(eq(schema.paymentLedger.id, id));
  return row;
}

export async function loadByProviderRef(provider: PaymentProviderId, providerRef: string): Promise<LedgerRow | undefined> {
  const [row] = await db
    .select()
    .from(schema.paymentLedger)
    .where(and(eq(schema.paymentLedger.provider, provider), eq(schema.paymentLedger.providerRef, providerRef)));
  return row;
}

/** Charges of `provider` in `statuses`; with `olderThan`, only the ones not touched since then. */
export async function openCharges(provider: PaymentProviderId, statuses: readonly ChargeStatus[], olderThan?: Date): Promise<LedgerRow[]> {
  return db
    .select()
    .from(schema.paymentLedger)
    .where(
      and(
        eq(schema.paymentLedger.provider, provider),
        inArray(schema.paymentLedger.status, [...statuses]),
        olderThan ? lt(schema.paymentLedger.updatedAt, olderThan) : undefined,
      ),
    );
}

/** The column assignments of a patch (`payload` is merged into the jsonb, never replaced). */
export function setOf(patch: LedgerPatch): Record<string, unknown> {
  const { payload, ...cols } = patch;
  const set: Record<string, unknown> = { ...cols, updatedAt: new Date() };
  if (payload) {
    set.providerPayload = sql`coalesce(${schema.paymentLedger.providerPayload}, '{}'::jsonb) || ${JSON.stringify(payload)}::jsonb`;
  }
  return set;
}

/**
 * Moves the charge to `to` only if its current status is one of `from`; returns the updated row, or null when another
 * actor moved it first (the caller re-reads and decides).
 */
export async function transition(
  id: string,
  from: readonly ChargeStatus[],
  to: ChargeStatus,
  patch: LedgerPatch = {},
  extra?: SQL,
): Promise<LedgerRow | null> {
  const [row] = await db
    .update(schema.paymentLedger)
    .set({ ...setOf(patch), status: to })
    .where(and(eq(schema.paymentLedger.id, id), inArray(schema.paymentLedger.status, [...from]), extra))
    .returning();
  return row ?? null;
}

/** Updates columns without changing the status. */
export async function patchCharge(id: string, patch: LedgerPatch): Promise<LedgerRow | null> {
  const [row] = await db.update(schema.paymentLedger).set(setOf(patch)).where(eq(schema.paymentLedger.id, id)).returning();
  return row ?? null;
}

export function payloadOf(row: LedgerRow): ProviderPayload {
  return (row.providerPayload ?? {}) as ProviderPayload;
}

/** The fee split recorded at fulfilment (null before). */
export function splitOf(row: LedgerRow): { feeCents: number | null; creatorCents: number | null } {
  const p = payloadOf(row);
  const n = (v: unknown) => (typeof v === "number" && Number.isSafeInteger(v) ? v : null);
  return { feeCents: n(p.feeCents), creatorCents: n(p.creatorCents) };
}

/** Server view of a ledger row. */
export function toCharge(row: LedgerRow, extra: { payment?: Record<string, unknown> | null } = {}): Charge {
  return {
    id: row.id,
    provider: row.provider as PaymentProviderId,
    providerRef: row.providerRef,
    kind: row.kind as ChargeKind,
    agentId: row.agentId,
    userId: row.buyerUserId,
    status: row.status as ChargeStatus,
    amountCents: row.amountCents,
    currency: row.currency,
    ...splitOf(row),
    error: row.error,
    payment: extra.payment ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    confirmedAt: row.confirmedAt,
    fulfilledAt: row.fulfilledAt,
  };
}
