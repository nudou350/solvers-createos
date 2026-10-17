import "./helpers/fake-env.js";
import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";

// Kill switch and memory access against a real Postgres (PACKAGE_SPEC.md 11.2, 15.4 and P0).
// Runs only with TEST_DATABASE_URL (a DISPOSABLE migrated database: `db:migrate`); skipped without it.
//
// NEVER point it at the dev database: the test creates and deletes rows (prefix "p0test", its two agents and users).

const url = process.env.TEST_DATABASE_URL;
const PREFIX = "p0test";
const AGENT = "0000000000000000000000000000e0e0";
const OTHER = "11111111111111111111111111111111";

describe("kill switch and memory with a database", { skip: url ? false : "set TEST_DATABASE_URL (disposable migrated database)" }, () => {
  let db: typeof import("../src/db/index.js").db;
  let schema: typeof import("../src/db/index.js").schema;
  let pool: typeof import("../src/db/index.js").pool;
  let getSession: typeof import("../src/runtime/engine.js").getSession;
  let assertMemoryAccess: typeof import("../src/mcp/tools.js").assertMemoryAccess;
  let findAgentRow: typeof import("../src/store/catalog.js").findAgentRow;
  let eq: typeof import("drizzle-orm").eq;
  let like: typeof import("drizzle-orm").like;
  let inArray: typeof import("drizzle-orm").inArray;
  /** users.id of the buyer and of the creator (created in `before`). */
  let USER = "";
  let CREATOR_USER = "";

  const agentRow = (id: string, slug: string) => ({
    id,
    slug,
    name: "Test agent",
    tagline: "t",
    description: "d",
    category: "Other",
    creatorId: `${PREFIX}-creator`,
    version: "1.0.0",
    versionHash: "ab".repeat(32),
    priceCents: 500,
    listed: true,
  });

  async function newSession(id: string, over: Record<string, unknown> = {}) {
    await db.insert(schema.sessions).values({ id, userId: USER, agentId: AGENT, version: "1.0.0", access: "trial", ...over });
  }

  async function cleanup() {
    await db.delete(schema.sessions).where(like(schema.sessions.id, `${PREFIX}%`));
    await db.delete(schema.licenses).where(inArray(schema.licenses.agentId, [AGENT, OTHER]));
    await db.delete(schema.agents).where(like(schema.agents.slug, `${PREFIX}%`));
    await db.delete(schema.creators).where(like(schema.creators.id, `${PREFIX}%`));
    await db.delete(schema.users).where(like(schema.users.email, `${PREFIX}%`));
  }

  async function newUser(name: string): Promise<string> {
    const [u] = await db.insert(schema.users).values({ email: `${PREFIX}-${name}@example.test` }).returning({ id: schema.users.id });
    return u!.id;
  }

  before(async () => {
    Object.assign(process.env, { DATABASE_URL: url });
    ({ db, schema, pool } = await import("../src/db/index.js"));
    ({ getSession } = await import("../src/runtime/engine.js"));
    ({ assertMemoryAccess } = await import("../src/mcp/tools.js"));
    ({ findAgentRow } = await import("../src/store/catalog.js"));
    ({ eq, like, inArray } = await import("drizzle-orm"));
    await cleanup();
    USER = await newUser("buyer");
    CREATOR_USER = await newUser("creator");
    await db.insert(schema.agents).values(agentRow(AGENT, `${PREFIX}-agent`));
    await db.insert(schema.agents).values(agentRow(OTHER, `${PREFIX}-other`));
  });

  after(async () => {
    if (!db) return;
    await cleanup();
    await pool.end();
  });

  it("the column starts as 'active'", async () => {
    const [row] = await db.select().from(schema.agents).where(eq(schema.agents.id, AGENT));
    assert.equal(row!.platformStatus, "active");
  });

  it("suspending in the database drops the open session; resuming brings it back", async () => {
    await newSession(`${PREFIX}-s1`);
    assert.equal((await getSession(`${PREFIX}-s1`, USER)).id, `${PREFIX}-s1`);

    await db.update(schema.agents).set({ platformStatus: "suspended" }).where(eq(schema.agents.id, AGENT));
    await assert.rejects(getSession(`${PREFIX}-s1`, USER), (e: unknown) => (e as { code?: string }).code === "agent_unavailable");

    await db.update(schema.agents).set({ platformStatus: "active" }).where(eq(schema.agents.id, AGENT));
    assert.equal((await getSession(`${PREFIX}-s1`, USER)).id, `${PREFIX}-s1`);
  });

  it("memory: refused without a session or license; allowed with an open (trial) session", async () => {
    await db.delete(schema.sessions).where(like(schema.sessions.id, `${PREFIX}%`));
    const [row] = await db.select().from(schema.agents).where(eq(schema.agents.id, AGENT));
    await assert.rejects(assertMemoryAccess(USER, row!), (e: unknown) => (e as { code?: string }).code === "memory_no_access");

    await newSession(`${PREFIX}-s2`, { access: "trial" });
    await assert.doesNotReject(assertMemoryAccess(USER, row!));
  });

  it("memory: an expired session does not count; a license does; a suspended agent refuses even with a license", async () => {
    await db.delete(schema.sessions).where(like(schema.sessions.id, `${PREFIX}%`));
    await newSession(`${PREFIX}-s3`, { expiresAt: new Date(Date.now() - 60_000) });
    const [row] = await db.select().from(schema.agents).where(eq(schema.agents.id, AGENT));
    await assert.rejects(assertMemoryAccess(USER, row!), (e: unknown) => (e as { code?: string }).code === "memory_no_access");

    await db.insert(schema.licenses).values({ agentId: AGENT, userId: USER });
    await assert.doesNotReject(assertMemoryAccess(USER, row!));

    await db.update(schema.agents).set({ platformStatus: "suspended" }).where(eq(schema.agents.id, AGENT));
    const [suspended] = await db.select().from(schema.agents).where(eq(schema.agents.id, AGENT));
    await assert.rejects(assertMemoryAccess(USER, suspended!), (e: unknown) => (e as { code?: string }).code === "agent_unavailable");
    await db.update(schema.agents).set({ platformStatus: "active" }).where(eq(schema.agents.id, AGENT));
  });

  it("memory: a license of ANOTHER agent does not count", async () => {
    const [other] = await db.select().from(schema.agents).where(eq(schema.agents.id, OTHER));
    await assert.rejects(assertMemoryAccess(USER, other!), (e: unknown) => (e as { code?: string }).code === "memory_no_access");
  });

  it("findAgentRow: an id (32 hex) looks up by id, anything else by slug", async () => {
    assert.equal((await findAgentRow(AGENT)).slug, `${PREFIX}-agent`);
    assert.equal((await findAgentRow(`${PREFIX}-other`)).id, OTHER);
    await assert.rejects(findAgentRow(`${PREFIX}-does-not-exist`), (e: unknown) => (e as { status?: number }).status === 404);
  });

  it("listCreators: a creator with only suspended Solvers leaves the list", async () => {
    const { listCreators } = await import("../src/store/catalog.js");
    const ids = async () => (await listCreators()).map((c) => c.id);
    await db.insert(schema.creators).values({ id: `${PREFIX}-creator`, userId: CREATOR_USER, name: "Test creator" });
    assert.ok((await ids()).includes(`${PREFIX}-creator`));

    await db.update(schema.agents).set({ platformStatus: "suspended" }).where(like(schema.agents.slug, `${PREFIX}%`));
    assert.ok(!(await ids()).includes(`${PREFIX}-creator`));

    await db.update(schema.agents).set({ platformStatus: "active" }).where(eq(schema.agents.id, AGENT));
    assert.ok((await ids()).includes(`${PREFIX}-creator`), "one active Solver is enough to list the creator");
  });
});
