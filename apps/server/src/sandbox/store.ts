import { and, asc, desc, eq, lt, ne, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import type { SandboxStore } from "./pool.js";

// `sandboxes` / `sandbox_runs` in Postgres. Loaded lazily by deps.ts, so pool/tests never open a database connection.

export function dbSandboxStore(): SandboxStore {
  const t = schema.sandboxes;
  return {
    async active(userId, sessionId) {
      const [row] = await db
        .select()
        .from(t)
        .where(and(eq(t.userId, userId), eq(t.sessionId, sessionId), eq(t.status, "active")))
        .orderBy(desc(t.createdAt))
        .limit(1);
      return row ?? null;
    },
    async latestActive(userId) {
      const [row] = await db
        .select()
        .from(t)
        .where(and(eq(t.userId, userId), eq(t.status, "active")))
        .orderBy(desc(t.lastUsedAt))
        .limit(1);
      return row ?? null;
    },
    async get(id) {
      // Ids come from the model: anything that is not a uuid is simply unknown.
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const [row] = await db.select().from(t).where(eq(t.id, id));
      return row ?? null;
    },
    async list(userId, sessionId, status) {
      return db
        .select()
        .from(t)
        .where(and(eq(t.userId, userId), eq(t.sessionId, sessionId), eq(t.status, status)))
        .orderBy(asc(t.createdAt));
    },
    async insert(row) {
      const [created] = await db.insert(t).values(row).returning();
      return created!;
    },
    async update(id, patch) {
      const { addRuns, ...rest } = patch;
      await db
        .update(t)
        .set({ ...rest, ...(addRuns ? { runs: sql`${t.runs} + ${addRuns}` } : {}) })
        .where(eq(t.id, id));
    },
    async idle(before) {
      return db
        .select()
        .from(t)
        .where(and(ne(t.status, "destroyed"), lt(t.lastUsedAt, before)))
        .orderBy(asc(t.lastUsedAt))
        .limit(100);
    },
    async logRun(r) {
      await db.insert(schema.sandboxRuns).values(r);
    },
  };
}
