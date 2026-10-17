import type { PaymentProvider, PaymentProviderId } from "./types.js";

// Provider registry: every provider the server knows, by id. `initPayments()` (index.ts) registers the real ones at boot;
// tests register their own instances (e.g. a fresh FakeProvider).

const providers = new Map<PaymentProviderId, PaymentProvider>();

export function registerProvider(p: PaymentProvider): void {
  providers.set(p.id, p);
}

export function getProvider<T extends PaymentProvider = PaymentProvider>(id: PaymentProviderId): T {
  const p = providers.get(id);
  if (!p) throw new Error(`payment provider ${id} is not registered`);
  return p as T;
}

export function hasProvider(id: PaymentProviderId): boolean {
  return providers.has(id);
}

export function registeredProviders(): PaymentProvider[] {
  return [...providers.values()];
}

/** Runs `reconcile` on every provider; one failing provider does not stop the others. */
export async function reconcileAll(now: Date): Promise<number> {
  let advanced = 0;
  for (const p of providers.values()) {
    try {
      advanced += (await p.reconcile(now)).advanced;
    } catch (e) {
      console.error(`[payments] reconcile ${p.id} failed:`, (e as Error).message);
    }
  }
  return advanced;
}
