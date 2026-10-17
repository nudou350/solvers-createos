import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

import { db, schema } from "../db/index.js";
import { notFound } from "../lib/http.js";
import { alertAdmin } from "./alerts.js";
import { insertCharge, loadCharge, openCharges, setOf, toCharge as toChargeOf, transition, type LedgerRow, type ProviderPayload } from "./ledger.js";
import { OPEN_STATUSES, PAID_FULFILS } from "./lifecycle.js";
import { PLATFORM_FEE_BPS, feeSplit } from "./stripe-rules.js";
import type { Charge, ChargeContext, ChargeIntent, PaymentProvider, PaymentProviderId } from "./types.js";

// Base of the payment providers (stripe and the in-memory fake). Subclasses implement only the payment side (open the
// payment, read its state); the ledger, the lifecycle, the fulfilment (license grant) and the reconcile loop live here.

/** What the payment provider says about a charge. */
export type PaymentState = "paid" | "pending" | "expired" | "failed";

export type StartedPayment = { providerRef?: string | null; payload?: ProviderPayload };

/**
 * Marks a paid charge fulfilled and grants its license in ONE transaction. Idempotent: only the caller whose conditional
 * update matches inserts the license, and the license is unique per Checkout Session (`stripe_checkout_session_id`).
 * Returns the fulfilled row, or null when the charge was already settled (another delivery got there first) or can no
 * longer be fulfilled (refunded).
 */
export async function fulfilCharge(row: LedgerRow, providerRef: string, now = new Date(), payload?: ProviderPayload): Promise<LedgerRow | null> {
  const split = { ...feeSplit(row.amountCents), feeBps: PLATFORM_FEE_BPS };
  return db.transaction(async (tx) => {
    const [done] = await tx
      .update(schema.paymentLedger)
      .set({
        ...setOf({
          providerRef,
          error: null,
          confirmedAt: row.confirmedAt ?? now,
          fulfilledAt: now,
          payload: { ...payload, ...split },
        }),
        status: "fulfilled",
      })
      .where(and(eq(schema.paymentLedger.id, row.id), inArray(schema.paymentLedger.status, [...PAID_FULFILS])))
      .returning();
    if (!done) return null;
    await tx
      .insert(schema.licenses)
      .values({ id: randomUUID(), userId: done.buyerUserId, agentId: done.agentId, stripeCheckoutSessionId: providerRef })
      .onConflictDoNothing({ target: schema.licenses.stripeCheckoutSessionId });
    return done;
  });
}

export abstract class PlatformProvider implements PaymentProvider {
  abstract readonly id: PaymentProviderId;
  /** Unpaid charges younger than this are left to the provider's webhook by the reconcile job. */
  protected reconcileAfterMs(): number {
    return 0;
  }
  /** Opens the payment at the provider (called right after the ledger row is written). */
  protected abstract startPayment(row: LedgerRow, intent: ChargeIntent, ctx: ChargeContext): Promise<StartedPayment>;
  /** Re-reads the payment at the provider. */
  protected abstract paymentState(row: LedgerRow, now: Date): Promise<PaymentState>;
  /** Provider-facing data for the client (e.g. the hosted checkout URL). */
  protected paymentView(_row: LedgerRow): Record<string, unknown> | null {
    return null;
  }

  view(row: LedgerRow): Charge {
    return toChargeOf(row, { payment: this.paymentView(row) });
  }

  async createCharge(intent: ChargeIntent, ctx: ChargeContext): Promise<Charge> {
    const id = randomUUID();
    let row = await insertCharge({
      id,
      provider: this.id,
      kind: intent.kind,
      buyerUserId: intent.userId,
      payerUserId: intent.userId,
      agentId: intent.agentId,
      amountCents: intent.amountCents,
      currency: intent.currency,
      status: "created",
      providerPayload: ctx.ip ? { ip: ctx.ip } : {},
    });
    try {
      const started = await this.startPayment(row, intent, ctx);
      row =
        (await transition(id, ["created"], "pending_payment", {
          providerRef: started.providerRef ?? null,
          ...(started.payload ? { payload: started.payload } : {}),
        })) ?? (await loadCharge(id))!;
    } catch (e) {
      await transition(id, ["created"], "failed", { error: ((e as Error).message ?? "provider error").slice(0, 500) });
      throw e;
    }
    return this.view(row);
  }

  async load(chargeId: string): Promise<LedgerRow> {
    const row = await loadCharge(chargeId);
    if (!row || row.provider !== this.id) throw notFound("Charge not found");
    return row;
  }

  /** Marks the charge paid (the provider proved it). */
  protected async markPaid(row: LedgerRow): Promise<LedgerRow> {
    return (await transition(row.id, ["created", "pending_payment", "expired"], "confirmed", { confirmedAt: new Date(), error: null })) ?? (await loadCharge(row.id))!;
  }

  /**
   * The provider proved the payment: fulfil (ledger + license, one transaction). A payment for a charge that can no
   * longer be fulfilled (refunded by hand) is flagged to the admins instead.
   */
  protected async settlePaid(row: LedgerRow, providerRef: string, payload?: ProviderPayload): Promise<LedgerRow> {
    const done = await fulfilCharge(row, providerRef, new Date(), payload);
    if (done) return done;
    const current = (await loadCharge(row.id))!;
    if (current.status !== "fulfilled") {
      await alertAdmin(`paid-after-${current.status}:${row.id}`, `charge ${row.id} is ${current.status} but ${this.id} reports it paid (${providerRef}). Check it manually.`);
    }
    return current;
  }

  /** Re-reads an open charge at the provider; a paid one is fulfilled right away. */
  async confirm(chargeId: string): Promise<Charge> {
    let row = await this.load(chargeId);
    if (row.status === "created" || row.status === "pending_payment" || row.status === "expired") {
      const state = await this.paymentState(row, new Date());
      if (state === "paid") row = await this.settlePaid(await this.markPaid(row), row.providerRef ?? row.id);
      else if (state === "expired" && row.status !== "expired") row = (await transition(row.id, ["created", "pending_payment"], "expired")) ?? row;
      else if (state === "failed") row = (await transition(row.id, ["created", "pending_payment"], "failed")) ?? row;
    }
    return this.view(row);
  }

  async fulfill(chargeId: string): Promise<Charge> {
    const row = await this.load(chargeId);
    if (row.status !== "confirmed" && row.status !== "fulfilling") return this.view(row);
    return this.view(await this.settlePaid(row, row.providerRef ?? row.id));
  }

  /** Settles open charges whose notification was lost: paid -> fulfilled, closed at the provider -> expired/failed. */
  async reconcile(now: Date): Promise<{ advanced: number }> {
    let advanced = 0;
    const unpaidBefore = now.getTime() - this.reconcileAfterMs();
    for (const row of await openCharges(this.id, OPEN_STATUSES)) {
      if ((row.status === "created" || row.status === "pending_payment") && row.createdAt.getTime() > unpaidBefore) continue;
      try {
        const after = await this.reconcileOne(row, now);
        if (after.status !== row.status) advanced++;
      } catch (e) {
        console.error(`[payments] reconcile ${row.id} failed:`, (e as Error).message);
      }
    }
    return { advanced };
  }

  protected async reconcileOne(row: LedgerRow, now: Date): Promise<LedgerRow> {
    switch (row.status) {
      case "created":
      case "pending_payment": {
        const state = await this.paymentState(row, now);
        if (state === "paid") return this.settlePaid(await this.markPaid(row), row.providerRef ?? row.id);
        if (state === "failed") return (await transition(row.id, ["created", "pending_payment"], "failed")) ?? row;
        if (state === "expired") return (await transition(row.id, ["created", "pending_payment"], "expired")) ?? row;
        return row;
      }
      case "confirmed":
      case "fulfilling":
        return this.settlePaid(row, row.providerRef ?? row.id);
      default:
        return row;
    }
  }
}
