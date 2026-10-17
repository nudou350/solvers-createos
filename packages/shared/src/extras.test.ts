import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Agent,
  AuthEmailInput,
  AuthEmailResponse,
  CHARGE_STATUSES,
  ChargeView,
  CheckoutInput,
  CheckoutResponse,
  License,
  PublicConfig,
  RESERVED_SLUGS,
  SessionUser,
  canTransition,
  nextActionFor,
} from "./index.js";

const USER = "6f1c2b9e-7a3d-4c5e-9b8a-1d2e3f4a5b6c";

const config = {
  currency: "usd",
  feeBps: 1000,
  minPriceCents: 500,
  stripePublishableKey: "pk_test_123",
  devLogin: true,
  connectorUrl: "https://example.test/mcp",
  freeTrialUses: 3,
};

test("PublicConfig", () => {
  assert.deepEqual(PublicConfig.parse(config), config);
  assert.ok(PublicConfig.safeParse({ ...config, stripePublishableKey: null }).success);
  for (const b of [{ ...config, feeBps: 10_001 }, { ...config, minPriceCents: 5.5 }, { ...config, devLogin: undefined }]) {
    assert.equal(PublicConfig.safeParse(b).success, false, JSON.stringify(b));
  }
});

test("auth: email sign-in and the session user", () => {
  assert.deepEqual(AuthEmailInput.parse({ email: " Ana@Example.COM " }), { email: "ana@example.com" });
  assert.equal(AuthEmailInput.safeParse({ email: "not-an-email" }).success, false);
  assert.ok(AuthEmailResponse.safeParse({ ok: true }).success);
  assert.equal(AuthEmailResponse.parse({ ok: true, devLink: "http://localhost:3038/api/auth/verify?token=x" }).devLink?.includes("token="), true);
  assert.equal(AuthEmailResponse.safeParse({ ok: false }).success, false);
  assert.equal(SessionUser.parse({ userId: USER, email: "ana@example.com" }).userId, USER);
});

test("checkout input and response", () => {
  assert.ok(CheckoutInput.safeParse({ agentSlug: "createos" }).success);
  assert.equal(CheckoutInput.safeParse({ agentSlug: "" }).success, false);
  assert.ok(CheckoutResponse.safeParse({ url: "https://checkout.stripe.com/c/pay/cs_test_1" }).success);
  assert.equal(CheckoutResponse.safeParse({ url: "nope" }).success, false);
});

test("Agent prices are integer cents", () => {
  const agent = {
    id: "3f9a1c2e7b8d4e6fa1b2c3d4e5f60718",
    slug: "createos",
    name: "CreateOS Builder",
    tagline: "t",
    description: "d",
    category: "Development",
    creatorId: "c1",
    version: "1.0.0",
    versionHash: "h",
    priceCents: 900,
    trialAvailable: true,
    userRating: 0,
    reviewsCount: 0,
    verifiedUses: 0,
    evalScore: 0,
    requirements: [],
    packageContents: [],
    trend7d: 0,
    publishedAt: "2026-10-17T00:00:00Z",
  };
  assert.equal(Agent.parse(agent).priceCents, 900);
  assert.equal(Agent.safeParse({ ...agent, priceCents: 9.5 }).success, false);
});

test("License belongs to a user", () => {
  const l = License.parse({ id: USER, agentId: "a", userId: USER, acquiredAt: "2026-10-10T00:00:00Z", type: "permanent" });
  assert.deepEqual(Object.keys(l).sort(), ["acquiredAt", "agentId", "id", "type", "userId"]);
});

test("payments: statuses and the API view of a charge", () => {
  assert.deepEqual(CHARGE_STATUSES, ["created", "pending_payment", "confirmed", "fulfilling", "fulfilled", "refunding", "refunded", "expired", "failed"]);
  const view = {
    id: "ch_1",
    provider: "stripe",
    status: "fulfilled",
    kind: "license",
    agentId: "3f9a1c2e7b8d4e6fa1b2c3d4e5f60718",
    amountCents: 900,
    currency: "usd",
    error: null,
    createdAt: "2026-10-10T12:00:00.000Z",
    updatedAt: "2026-10-10T12:00:00.000Z",
    fulfilledAt: "2026-10-10T12:01:00.000Z",
  };
  assert.deepEqual(ChargeView.parse(view), view);
  assert.equal(ChargeView.safeParse({ ...view, status: "paid" }).success, false);
  assert.equal(ChargeView.safeParse({ ...view, amountCents: 9.5 }).success, false);
});

test("submissions: approval publishes directly", () => {
  assert.ok(canTransition("pending_review", "publishing"));
  assert.ok(canTransition("publishing", "published"));
  assert.ok(canTransition("publish_failed", "publishing"));
  assert.equal(canTransition("pending_review", "published"), false);
  assert.equal(nextActionFor("changes_requested"), "fix_and_resubmit");
  assert.equal(nextActionFor("pending_review"), "wait_review");
  assert.equal(nextActionFor("publishing"), "wait_publish");
  assert.equal(nextActionFor("published"), "none");
});

test("reserved slugs protect the platform and brands", () => {
  for (const s of ["solvers", "admin", "api", "mcp", "oauth", "claude"]) assert.ok(RESERVED_SLUGS.includes(s), s);
});
