import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { SKIP_WITHOUT_PAID } from "./helpers/repo-agents.js";

// cli:publish (database only) and the package selection (PACKAGE_SPEC.md 15 and 19), against a real Postgres. Needs TEST_DATABASE_URL (DISPOSABLE migrated database).
// NEVER point it at the dev database: the test creates and deletes rows (the test platform agent and the "pubcli" prefix).

const url = process.env.TEST_DATABASE_URL;
const PREFIX = "pubcli";
// The real platform Solver (PLATFORM_AGENTS): the test publishes a copy of it from a temporary folder.
const PLATFORM_ID = "c71ad0a50f750e75c71ad0a50f750e75";
const PLATFORM_SLUG = "criador-de-solvers";

describe("cli:publish with a database", { skip: url ? false : "set TEST_DATABASE_URL (disposable migrated database)" }, () => {
  let db: typeof import("../src/db/index.js").db;
  let schema: typeof import("../src/db/index.js").schema;
  let pool: typeof import("../src/db/index.js").pool;
  let d: typeof import("drizzle-orm");
  let mod: typeof import("../src/cli/publish.js");
  let loadPackage: typeof import("../src/runtime/packages.js").loadPackage;
  const root = mkdtempSync(join(tmpdir(), "solvers-pubcli-"));

  function writePackage(slug: string, id: string, version: string, extra: Record<string, unknown> = {}) {
    const dir = join(root, `${slug}-${version}`, slug);
    mkdirSync(join(dir, "steps"), { recursive: true });
    mkdirSync(join(dir, "knowledge"), { recursive: true });
    writeFileSync(
      join(dir, "manifest.json"),
      JSON.stringify({
        id,
        slug,
        name: "Solver Builder (test)",
        tagline: "Helps assemble the package",
        description: "Platform Solver, free",
        category: "Other",
        version,
        creator: { id: `${PREFIX}-platform`, name: "Solvers team", bio: "Platform" },
        requirements: [],
        packageContents: ["guide"],
        steps: [{ file: "steps/01-guide.md", gate: [] }],
        pricing: { priceCents: 0 },
        ...extra,
      }),
    );
    writeFileSync(join(dir, "steps", "01-guide.md"), "# Guide\n\nAssemble the package.");
    writeFileSync(join(dir, "knowledge", "a.md"), `Knowledge ${version}.`);
    return dir;
  }

  async function cleanup() {
    await db.delete(schema.agentPublishedVersions).where(d.eq(schema.agentPublishedVersions.agentId, PLATFORM_ID));
    await db.delete(schema.knowledgeChunks).where(d.eq(schema.knowledgeChunks.agentId, PLATFORM_ID));
    await db.delete(schema.agentSearchVectors).where(d.eq(schema.agentSearchVectors.agentId, PLATFORM_ID));
    await db.delete(schema.agents).where(d.eq(schema.agents.id, PLATFORM_ID));
    await db.delete(schema.creators).where(d.like(schema.creators.id, `${PREFIX}%`));
    await db.delete(schema.users).where(d.like(schema.users.email, `${PREFIX}%`));
  }

  before(async () => {
    Object.assign(process.env, {
      DATABASE_URL: url,
      JWT_SECRET: process.env.JWT_SECRET ?? "j".repeat(40),
      MEMORY_KEK: process.env.MEMORY_KEK ?? Buffer.alloc(32, 7).toString("base64"),
      SEARCH_MODE: "fts",
    });
    ({ db, schema, pool } = await import("../src/db/index.js"));
    d = await import("drizzle-orm");
    mod = await import("../src/cli/publish.js");
    ({ loadPackage } = await import("../src/runtime/packages.js"));
    await cleanup();
    // The platform creator profile already exists: publishing keeps its account.
    const [user] = await db.insert(schema.users).values({ email: `${PREFIX}-platform@example.test` }).returning({ id: schema.users.id });
    await db.insert(schema.creators).values({ id: `${PREFIX}-platform`, userId: user!.id, name: "Solvers team", invited: true });
  });

  after(async () => {
    rmSync(root, { recursive: true, force: true });
    if (!db) return;
    await cleanup();
    await pool.end();
  });

  it("platform Solver: active, price 0, listed, version recorded as approved", async () => {
    const pkg = loadPackage(writePackage(PLATFORM_SLUG, PLATFORM_ID, "1.0.0"));
    await mod.publishPackage(pkg);
    const [a] = await db.select().from(schema.agents).where(d.eq(schema.agents.id, PLATFORM_ID));
    assert.equal(a!.slug, PLATFORM_SLUG);
    assert.equal(a!.priceCents, 0);
    assert.equal(a!.platformStatus, "active");
    assert.equal(a!.listed, true);
    assert.equal(a!.versionHash, pkg.versionHash);
    assert.equal(a!.creatorId, `${PREFIX}-platform`);
    const [pv] = await db.select().from(schema.agentPublishedVersions).where(d.eq(schema.agentPublishedVersions.agentId, PLATFORM_ID));
    assert.deepEqual({ version: pv!.version, price: pv!.priceCents, hash: pv!.versionHash }, { version: "1.0.0", price: 0, hash: pkg.versionHash });
    const chunks = await db.select().from(schema.knowledgeChunks).where(d.eq(schema.knowledgeChunks.agentId, PLATFORM_ID));
    assert.deepEqual(chunks.map((c) => [c.version, c.content]), [["1.0.0", "Knowledge 1.0.0."]]);
  });

  it("a manifest price other than 0 is published as 0; republishing updates and does NOT lift an admin suspension", async () => {
    await db.update(schema.agents).set({ platformStatus: "suspended" }).where(d.eq(schema.agents.id, PLATFORM_ID));
    const pkg = loadPackage(writePackage(PLATFORM_SLUG, PLATFORM_ID, "1.1.0", { pricing: { priceCents: 900 } }));
    await mod.publishPackage(pkg);
    const [a] = await db.select().from(schema.agents).where(d.eq(schema.agents.id, PLATFORM_ID));
    assert.equal(a!.version, "1.1.0");
    assert.equal(a!.priceCents, 0);
    assert.equal(a!.platformStatus, "suspended");
    const versions = (await db.select().from(schema.agentPublishedVersions).where(d.eq(schema.agentPublishedVersions.agentId, PLATFORM_ID))).map((v) => v.version).sort();
    assert.deepEqual(versions, ["1.0.0", "1.1.0"], "older versions stay recorded");
  });

  describe("selectPackages", () => {
    const pk = (slug: string, id: string, source: "agents" | "published" = "agents") => ({ manifest: { slug, id }, source }) as never;
    const platform = pk(PLATFORM_SLUG, PLATFORM_ID);
    const normal = pk("frontend-react", "a".repeat(32));
    const all = [platform, normal];
    const slugs = (list: { manifest: { slug: string } }[]) => list.map((p) => p.manifest.slug);

    it("without names: every platform-folder package", () => {
      assert.deepEqual(slugs(mod.selectPackages(all, [])), [PLATFORM_SLUG, "frontend-react"]);
    });

    it("with names: by slug or id; an unknown name is refused with the reason", () => {
      assert.deepEqual(slugs(mod.selectPackages(all, ["frontend-react"])), ["frontend-react"]);
      assert.deepEqual(slugs(mod.selectPackages(all, [PLATFORM_ID])), [PLATFORM_SLUG], "also by id");
      assert.throws(() => mod.selectPackages(all, ["nao-existe"]), /published through the site/);
    });

    it("the real agents/ packages are all selected", { skip: SKIP_WITHOUT_PAID }, async () => {
      const { packages } = await import("../src/runtime/packages.js");
      const real = [...new Map([...packages().values()].map((p) => [p.manifest.id, p])).values()].filter((p) => (p.source ?? "agents") === "agents");
      const all = slugs(mod.selectPackages(real, []));
      assert.ok(all.length >= 6, `expected the agents/ packages (found ${all.join(", ")})`);
      assert.ok(all.includes("frontend-react") && all.includes("ui-design"));
    });
  });
});
