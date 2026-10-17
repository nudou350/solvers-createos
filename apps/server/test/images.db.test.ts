import { strict as assert } from "node:assert";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import sharp from "sharp";
import type { ImageStore } from "../src/images/store.js";

import "./helpers/fake-env.js";

// Review photos and the creator gallery against a real Postgres, through the real HTTP routes (CDN replaced by an
// in-memory fake). Runs only with TEST_DATABASE_URL (a DISPOSABLE migrated database); every row is keyed by AGENT.

const url = process.env.TEST_DATABASE_URL;
const PREFIX = "imgtest";
const AGENT = "0".repeat(24) + "1mg00001";
const uid = (n: number) => `1a9e0000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const BUYER = uid(1);
const STRANGER = uid(2);
const RACER = uid(3); // user only in the race (the 12 uploads per minute limit is per user)
const REVIEW_ID = `${AGENT}:${BUYER}`;

describe("images with a database", { skip: url ? false : "set TEST_DATABASE_URL (disposable migrated database)" }, () => {
  let db: typeof import("../src/db/index.js").db;
  let schema: typeof import("../src/db/index.js").schema;
  let pool: typeof import("../src/db/index.js").pool;
  let like: typeof import("drizzle-orm").like;
  let server: Server;
  let base = "";
  let cookie: (userId: string) => Promise<string>;

  const cdn = new Map<string, Buffer>();
  const fakeStore: ImageStore = {
    async put(key, data) {
      cdn.set(key, data);
    },
    async delete(key) {
      cdn.delete(key);
    },
    url: (key, kind) => `https://cdn.test/${kind}/${key}`,
  };

  const png = (w = 800, h = 600) => sharp({ create: { width: w, height: h, channels: 3, background: "#224488" } }).png().toBuffer();
  const upload = async (userId: string | null, body: Buffer | string, type = "image/png") =>
    fetch(`${base}/api/agents/${PREFIX}-agent/reviews/mine/images`, {
      method: "POST",
      headers: { "content-type": type, ...(userId ? { cookie: await cookie(userId) } : {}) },
      body: body as BodyInit,
    });
  const remove = async (userId: string, id: string) =>
    fetch(`${base}/api/agents/${PREFIX}-agent/reviews/mine/images/${id}`, { method: "DELETE", headers: { cookie: await cookie(userId) } });

  async function cleanup() {
    await db.delete(schema.reviewImages).where(like(schema.reviewImages.reviewId, `${AGENT}%`));
    await db.delete(schema.agentImages).where(like(schema.agentImages.agentId, AGENT));
    await db.delete(schema.reviews).where(like(schema.reviews.agentId, AGENT));
    await db.delete(schema.licenses).where(like(schema.licenses.agentId, AGENT));
    await db.delete(schema.agents).where(like(schema.agents.slug, `${PREFIX}%`));
    await db.delete(schema.creators).where(like(schema.creators.id, `${PREFIX}%`));
  }

  before(async () => {
    Object.assign(process.env, {
      DATABASE_URL: url,
      JWT_SECRET: process.env.JWT_SECRET ?? "j".repeat(40),
      SERVER_KEK: process.env.SERVER_KEK ?? Buffer.alloc(32, 7).toString("base64"),
    });
    ({ db, schema, pool } = await import("../src/db/index.js"));
    ({ like } = await import("drizzle-orm"));
    const { setImageStoreForTests } = await import("../src/images/store.js");
    const { createApp } = await import("../src/app.js");
    const { mounts } = await import("../src/modules.js");
    const { signSession, SESSION_COOKIE } = await import("../src/auth/jwt.js");
    cookie = async (userId) => `${SESSION_COOKIE}=${await signSession(userId)}`;
    setImageStoreForTests(fakeStore);

    await cleanup();
    await db.insert(schema.users).values([BUYER, STRANGER, RACER].map((id, i) => ({ id, email: `${PREFIX}-${i}@example.com` }))).onConflictDoNothing();
    await db.insert(schema.agents).values({
      id: AGENT, slug: `${PREFIX}-agent`, name: "Test agent", tagline: "t", description: "d", category: "Other",
      creatorId: `${PREFIX}-creator`, version: "1.0.0", versionHash: "ab".repeat(32), priceCents: 500, listed: true,
    });
    await new Promise<void>((resolve) => {
      server = createApp(mounts).listen(0, "127.0.0.1", () => resolve(undefined));
    });
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  after(async () => {
    server?.close();
    if (!db) return;
    await cleanup();
    await pool.end();
  });

  it("without a session: 401", async () => {
    assert.equal((await upload(null, await png())).status, 401);
  });

  it("no published review: 409 review_required", async () => {
    await db.insert(schema.licenses).values({ agentId: AGENT, userId: BUYER });
    const res = await upload(BUYER, await png());
    assert.equal(res.status, 409);
    assert.equal(((await res.json()) as { code: string }).code, "review_required");
  });

  it("without a license: 403, even with an own review", async () => {
    await db.insert(schema.reviews).values({ id: REVIEW_ID, agentId: AGENT, authorUserId: BUYER, rating: 5, text: "", contentHash: "00" });
    await db.insert(schema.reviews).values({ id: `${AGENT}:${STRANGER}`, agentId: AGENT, authorUserId: STRANGER, rating: 4, text: "", contentHash: "00" });
    assert.equal((await upload(STRANGER, await png())).status, 403);
    await db.insert(schema.licenses).values({ agentId: AGENT, userId: STRANGER });
  });

  it("refuses what is not an image (400) and an unaccepted type (400, body not read)", async () => {
    const junk = await upload(BUYER, "this is not an image", "image/png");
    assert.equal(junk.status, 400);
    assert.equal(((await junk.json()) as { code: string }).code, "image_invalid");
    assert.equal((await upload(BUYER, "<svg/>", "image/svg+xml")).status, 400);
    assert.equal(cdn.size, 0, "nothing reached the CDN");
  });

  it("attaches up to 3 photos; the 4th gets 409 image_limit and never reaches the CDN", async () => {
    for (let i = 1; i <= 3; i++) {
      const res = await upload(BUYER, await png(800 + i, 600));
      assert.equal(res.status, 200);
      assert.equal(((await res.json()) as unknown[]).length, i);
    }
    const extra = await upload(BUYER, await png());
    assert.equal(extra.status, 409);
    assert.equal(((await extra.json()) as { code: string }).code, "image_limit");
    assert.equal(cdn.size, 3);
  });

  it("they show in the review (GET /reviews and /agents/:slug) with the CDN URLs", async () => {
    const reviews = (await (await fetch(`${base}/api/agents/${PREFIX}-agent/reviews`)).json()) as Array<{ authorUserId: string; images: Array<{ url: string; thumbUrl: string }> }>;
    const mine = reviews.find((r) => r.authorUserId === BUYER)!;
    assert.equal(mine.images.length, 3);
    assert.match(mine.images[0]!.url, /^https:\/\/cdn\.test\/full\/solvers\/reviews\//);
    assert.match(mine.images[0]!.thumbUrl, /^https:\/\/cdn\.test\/thumb\//);
    assert.equal(reviews.find((r) => r.authorUserId === STRANGER)!.images.length, 0);

    const detail = (await (await fetch(`${base}/api/agents/${PREFIX}-agent`)).json()) as { reviews: Array<{ images: unknown[] }>; images: unknown[] };
    assert.equal(detail.reviews.reduce((n, r) => n + r.images.length, 0), 3);
    assert.deepEqual(detail.images, []);
  });

  it("removing frees the slot, deletes from the CDN and only works for the own review's photo", async () => {
    const [first] = (await (await fetch(`${base}/api/agents/${PREFIX}-agent/reviews`)).json() as Array<{ authorUserId: string; images: Array<{ id: string }> }>)
      .filter((r) => r.authorUserId === BUYER).map((r) => r.images[0]!);
    assert.equal((await remove(STRANGER, first!.id)).status, 404, "another person's photo is not found");
    const res = await remove(BUYER, first!.id);
    assert.equal(res.status, 200);
    assert.equal(((await res.json()) as unknown[]).length, 2);
    assert.equal(cdn.size, 2);
    assert.equal((await upload(BUYER, await png())).status, 200);
    assert.equal(cdn.size, 3);
  });

  it("concurrent uploads never pass the limit and use every slot", async () => {
    await db.insert(schema.licenses).values({ agentId: AGENT, userId: RACER });
    await db.insert(schema.reviews).values({ id: `${AGENT}:${RACER}`, agentId: AGENT, authorUserId: RACER, rating: 5, text: "", contentHash: "00" });
    cdn.clear();
    const results = await Promise.all(Array.from({ length: 6 }, async () => (await upload(RACER, await png())).status));
    assert.equal(results.filter((s) => s === 200).length, 3, JSON.stringify(results));
    assert.ok(results.every((s) => s === 200 || s === 409), JSON.stringify(results));
    const rows = await db.select().from(schema.reviewImages).where(like(schema.reviewImages.reviewId, `${AGENT}:${RACER}`));
    assert.deepEqual(rows.map((r) => r.position).sort(), [0, 1, 2]);
    assert.equal(cdn.size, 3, "the uploads that lost the race leave no orphan on the CDN");
  });

  it("the creator gallery shows in the detail, in position order", async () => {
    await db.insert(schema.agentImages).values([
      { id: `${PREFIX}-b`, agentId: AGENT, position: 1, key: "solvers/agents/x/b", width: 10, height: 10 },
      { id: `${PREFIX}-a`, agentId: AGENT, position: 0, key: "solvers/agents/x/a", width: 10, height: 10 },
    ]);
    const detail = (await (await fetch(`${base}/api/agents/${PREFIX}-agent`)).json()) as { images: Array<{ id: string }> };
    assert.deepEqual(detail.images.map((i) => i.id), [`${PREFIX}-a`, `${PREFIX}-b`]);
  });

  it("the database refuses positions out of range (gallery 0..4, review 0..2)", async () => {
    await assert.rejects(db.insert(schema.agentImages).values({ id: `${PREFIX}-c`, agentId: AGENT, position: 5, key: "k", width: 1, height: 1 }));
    await assert.rejects(db.insert(schema.reviewImages).values({ id: `${PREFIX}-d`, reviewId: REVIEW_ID, position: 3, key: "k", width: 1, height: 1 }));
  });
});
