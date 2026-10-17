import type { LedgerRow } from "../ledger.js";
import { PlatformProvider, type PaymentState, type StartedPayment } from "../platform-provider.js";
import type { WebhookRequest } from "../types.js";

// In-memory payment provider for tests: the money side lives in memory (`pay()`, `expire()`), everything else is the
// real platform path (ledger, lifecycle, fulfilment with the license grant, reconcile). `replayWebhook()` delivers the
// same notification again.

export class FakeProvider extends PlatformProvider {
  readonly id = "fake" as const;
  private readonly paid = new Set<string>();
  private readonly expired = new Set<string>();
  /** Webhook notifications received (including replays). */
  webhooks = 0;

  protected async startPayment(row: LedgerRow): Promise<StartedPayment> {
    return { providerRef: `fake_${row.id}`, payload: { checkoutUrl: `https://checkout.invalid/${row.id}` } };
  }

  protected async paymentState(row: LedgerRow): Promise<PaymentState> {
    if (this.paid.has(row.id)) return "paid";
    return this.expired.has(row.id) ? "expired" : "pending";
  }

  /** The buyer pays (in memory). */
  pay(chargeId: string): void {
    this.paid.add(chargeId);
  }

  /** The provider closes the unpaid payment (in memory). */
  expire(chargeId: string): void {
    this.expired.add(chargeId);
  }

  /** Body `{ "chargeId": "..." }`; the state comes from `paymentState`, never from the body. */
  async handleWebhook(raw: WebhookRequest): Promise<{ chargeId: string } | null> {
    this.webhooks++;
    let chargeId: string | undefined;
    try {
      chargeId = (JSON.parse(raw.body) as { chargeId?: string }).chargeId;
    } catch {
      return null;
    }
    if (!chargeId) return null;
    await this.confirm(chargeId);
    return { chargeId };
  }

  replayWebhook(chargeId: string) {
    return this.handleWebhook({ headers: {}, query: {}, body: JSON.stringify({ chargeId }) });
  }
}
