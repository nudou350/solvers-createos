import { Router } from "express";

import { requireUser } from "../auth/middleware.js";
import { h, notFound, unauthorized } from "../lib/http.js";
import { initPayments } from "./index.js";
import { loadCharge, toCharge } from "./ledger.js";
import { getProvider, hasProvider } from "./registry.js";
import { toChargeView, type ChargeView, type PaymentProviderId } from "./types.js";

// Charge status for the buyer (e.g. the library polling right after the Checkout redirect):
//
//   GET /api/purchases/:chargeId   ChargeView (only the buyer sees it)
//
// Purchases start at POST /api/checkout (stripe-routes.ts).

initPayments();

export const paymentsRouter = Router();

paymentsRouter.get(
  "/purchases/:chargeId",
  requireUser,
  h(async (req): Promise<ChargeView> => {
    const userId = req.userId;
    if (!userId) throw unauthorized();
    const row = await loadCharge(String(req.params.chargeId));
    if (!row || row.buyerUserId !== userId) throw notFound("Charge not found");
    // Open charges are re-checked at the provider on read; settled ones are returned as stored.
    if ((row.status === "created" || row.status === "pending_payment") && hasProvider(row.provider as PaymentProviderId)) {
      const charge = await getProvider(row.provider as PaymentProviderId)
        .confirm(row.id)
        .catch(() => toCharge(row));
      return toChargeView(charge);
    }
    return toChargeView(toCharge(row));
  }),
);
