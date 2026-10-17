import { every, type Job } from "../lib/jobs.js";
import { reconcileStripeCheckouts } from "./index.js";

// Periodic jobs of the payments module (listed by src/jobs.ts):
// - reconcile (every 5 min): Checkout Sessions pending for over an hour are read from Stripe and settled, and paid
//   charges whose fulfilment was interrupted are finished.

export const paymentsJobs: Job[] = [every(5 * 60_000, "payments: reconcile stripe checkouts", () => reconcileStripeCheckouts(new Date()))];
