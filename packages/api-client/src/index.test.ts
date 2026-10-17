import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, createApi } from "./index.js";

const USER = "6f1c2b9e-7a3d-4c5e-9b8a-1d2e3f4a5b6c";

type Seen = { url: string; method: string; body: unknown; headers: Record<string, string> };

function fakeFetch(routes: Record<string, (body: unknown) => unknown>, seen: Seen[]): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    seen.push({ url, method, body, headers: (init?.headers ?? {}) as Record<string, string> });
    const key = `${method} ${new URL(url).pathname}`;
    const handler = routes[key];
    if (!handler) return new Response(JSON.stringify({ error: "not found", code: "not_found" }), { status: 404 });
    return new Response(JSON.stringify(handler(body)), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

test("email sign-in: authEmail, me, logout", async () => {
  const seen: Seen[] = [];
  const api = createApi({
    baseUrl: "http://localhost:3038/",
    fetch: fakeFetch(
      {
        "POST /api/auth/email": () => ({ ok: true, devLink: "http://localhost:3038/api/auth/verify?token=abc" }),
        "GET /api/auth/me": () => ({ userId: USER, email: "ana@example.com" }),
        "POST /api/auth/logout": () => ({ ok: true }),
      },
      seen,
    ),
  });
  const sent = await api.authEmail("ana@example.com");
  assert.equal(sent.ok, true);
  assert.equal(sent.devLink, "http://localhost:3038/api/auth/verify?token=abc");
  assert.deepEqual(seen[0]!.body, { email: "ana@example.com" });
  assert.equal(seen[0]!.url, "http://localhost:3038/api/auth/email");
  assert.deepEqual(await api.me(), { userId: USER, email: "ana@example.com" });
  assert.deepEqual(await api.logout(), { ok: true });
});

test("checkout: posts the slug and returns the hosted page url", async () => {
  const seen: Seen[] = [];
  const api = createApi({
    fetch: fakeFetch({ "POST /api/checkout": () => ({ url: "https://checkout.stripe.com/c/pay/cs_test_1" }) }, seen),
    baseUrl: "http://localhost:3038",
    token: "tok",
  });
  const res = await api.createCheckout("createos");
  assert.equal(res.url, "https://checkout.stripe.com/c/pay/cs_test_1");
  assert.deepEqual(seen[0]!.body, { agentSlug: "createos" });
  assert.equal(seen[0]!.method, "POST");
  assert.equal(seen[0]!.headers.authorization, "Bearer tok");
});

test("checkout of an owned Solver keeps the already_owned code", async () => {
  const api = createApi({
    baseUrl: "http://localhost:3038",
    fetch: (async () =>
      new Response(JSON.stringify({ error: "You already have this specialist's license.", code: "already_owned", licenseId: "l1" }), { status: 409 })) as typeof fetch,
  });
  await assert.rejects(api.createCheckout("createos"), (e: unknown) => e instanceof ApiError && e.status === 409 && e.code === "already_owned" && e.body.licenseId === "l1");
});

test("getCharge reads the buyer's charge status", async () => {
  const charge = {
    id: "ch_1",
    provider: "stripe",
    status: "pending_payment",
    kind: "license",
    agentId: "a1",
    amountCents: 900,
    currency: "usd",
    error: null,
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
    fulfilledAt: null,
  };
  const api = createApi({ baseUrl: "http://x", fetch: fakeFetch({ "GET /api/purchases/ch_1": () => charge }, []) });
  assert.equal((await api.getCharge("ch_1")).status, "pending_payment");
});

test("a 401 becomes an ApiError with the server code", async () => {
  const api = createApi({
    baseUrl: "http://localhost:3038",
    fetch: (async () => new Response(JSON.stringify({ error: "Sign in first.", code: "unauthorized" }), { status: 401 })) as typeof fetch,
  });
  await assert.rejects(api.me(), (e: unknown) => e instanceof ApiError && e.status === 401 && e.code === "unauthorized" && e.message === "Sign in first.");
});

test("errors keep status and code", async () => {
  const api = createApi({ fetch: fakeFetch({}, []), baseUrl: "http://localhost:3038" });
  await assert.rejects(api.getConfig(), (e: unknown) => (e as { status: number; code: string }).status === 404 && (e as { code: string }).code === "not_found");
});

test("the client surface is exactly the email/Stripe API", () => {
  const api = createApi({ fetch: fakeFetch({}, []) });
  assert.deepEqual(Object.keys(api).sort(), [
    "adminApprove", "adminApproveSubmission", "adminFinishSubmission", "adminGetSubmission", "adminGetSubmissionFile",
    "adminListSubmissions", "adminRejectSubmission", "adminRequestChanges", "adminRevokeSubmission", "adminSearchSubmissionKnowledge",
    "authEmail", "createCheckout", "createTelegramLink", "deleteAllMemories", "deleteMemory", "deleteReviewImage", "getAgent",
    "getAgents", "getCategories", "getCharge", "getConfig", "getConnector", "getCreator", "getCreatorDashboard", "getCreatorMe",
    "getCreators", "getMemories", "getMemoriesCount", "getMyAccess", "getMyLicenses", "getMySubmission", "getMyTrials", "getMyUsage",
    "getProfile", "getReputation", "getReviews", "listMySubmissions", "logout", "me", "requestHelp", "revokeConnector",
    "saveCreatorProfile", "search", "submitReview", "updateProfile", "uploadReviewImage", "uploadSubmission",
  ]);
});

test("submitReview posts rating and text to the Solver", async () => {
  const seen: Seen[] = [];
  const review = {
    id: "r1",
    agentId: "a1",
    authorUserId: USER,
    rating: 5,
    text: "Great",
    createdAt: "2026-10-17T00:00:00Z",
    verifiedPurchase: true,
    authorName: null,
  };
  const api = createApi({ baseUrl: "http://x", fetch: fakeFetch({ "POST /api/agents/my%20solver/reviews": () => review }, seen) });
  const r = await api.submitReview("my solver", 5, "Great");
  assert.equal(r.rating, 5);
  assert.deepEqual(r.images, []);
  assert.deepEqual(seen[0]!.body, { rating: 5, text: "Great" });
});
