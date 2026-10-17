import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema, type Db } from "../db/index.js";
import { env } from "../env.js";
import { HttpError } from "../lib/http.js";
import { randomId } from "../lib/crypto.js";
import { EMPTY_MEMORY, MemoryRuleError, applyForget, applySave, readPayload, type MemoryNote, type MemoryPayload, type SaveOp } from "./rules.js";

// Encrypted memories (decisions.md D8): encrypted at rest, never stored in the clear.
//
// 1. Each user has a random 32-byte data key (DEK), created on first use.
// 2. The DEK is stored only wrapped with MEMORY_KEK (AES-256-GCM, iv | tag | ct) in `memory_keys`, one row per user.
// 3. Each memory is AES-256-GCM with a random iv, bound to its owner and Solver by the AAD.

const KEK = Buffer.from(env.MEMORY_KEK, "base64");
if (KEK.length !== 32) throw new Error("MEMORY_KEK must be 32 bytes in base64");

/** AES-256-GCM. `aad` binds the ciphertext to its owner (user|solver): rows cannot be swapped. */
function seal(key: Buffer, plaintext: Buffer, aad?: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ciphertext };
}

function open(key: Buffer, iv: Buffer, tag: Buffer, ciphertext: Buffer, aad?: string): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  if (aad) decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Wraps a data key with MEMORY_KEK: iv(12) | tag(16) | ct(32). */
export function wrapKey(dataKey: Buffer): Buffer {
  const { iv, tag, ciphertext } = seal(KEK, dataKey);
  return Buffer.concat([iv, tag, ciphertext]);
}

export function unwrapKey(wrapped: Buffer): Buffer {
  return open(KEK, wrapped.subarray(0, 12), wrapped.subarray(12, 28), wrapped.subarray(28));
}

/** Plain connection or an open transaction (db.transaction): the caller decides the atomic scope. */
export type DbExecutor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * The user's memory data key, created on first use. Two concurrent first calls race on the primary key: the loser's
 * insert does nothing and both read back the winner's row, so a user never ends up with two keys.
 */
export async function memoryKeyFor(userId: string, exec: DbExecutor = db): Promise<Buffer> {
  const read = async () => {
    const [row] = await exec.select({ wrappedKey: schema.memoryKeys.wrappedKey }).from(schema.memoryKeys).where(eq(schema.memoryKeys.userId, userId));
    return row ? unwrapKey(row.wrappedKey) : null;
  };
  const existing = await read();
  if (existing) return existing;
  await exec.insert(schema.memoryKeys).values({ userId, wrappedKey: wrapKey(randomBytes(32)) }).onConflictDoNothing({ target: schema.memoryKeys.userId });
  const created = await read();
  if (!created) throw new Error("memory key could not be created");
  return created;
}

const aadOf = (userId: string, agentId: string) => `${userId}|${agentId}`;

function sealPayload(key: Buffer, userId: string, agentId: string, payload: MemoryPayload) {
  return seal(key, Buffer.from(JSON.stringify(payload)), aadOf(userId, agentId));
}

/**
 * Read, merge and write a specialist's memory without losing data under parallel calls (PACKAGE_SPEC.md 11.2).
 * `SELECT … FOR UPDATE` does not lock a row that does not exist yet, so the first write creates the row with
 * `INSERT … ON CONFLICT DO NOTHING` and only then locks it; the merge runs with the row locked. If `mutate` throws (limit
 * exceeded), the transaction rolls everything back, including the created row. `create: false` (forget): never creates
 * the row; without a memory it returns null.
 */
export async function updateMemory<T>(
  userId: string,
  agentId: string,
  key: Buffer,
  mutate: (cur: MemoryPayload) => { next: MemoryPayload; result: T },
  opts: { create?: boolean } = {},
): Promise<T | null> {
  const create = opts.create ?? true;
  return db.transaction(async (tx) => {
    if (create) {
      const empty = sealPayload(key, userId, agentId, EMPTY_MEMORY);
      await tx
        .insert(schema.memories)
        .values({ id: `mem_${randomId(10)}`, userId, agentId, ciphertext: empty.ciphertext, iv: empty.iv, tag: empty.tag, updatedAt: new Date() })
        .onConflictDoNothing({ target: [schema.memories.userId, schema.memories.agentId] });
    }
    const [row] = await tx
      .select()
      .from(schema.memories)
      .where(and(eq(schema.memories.userId, userId), eq(schema.memories.agentId, agentId)))
      .for("update");
    if (!row) return null;
    let cur: MemoryPayload;
    try {
      cur = readPayload(JSON.parse(open(key, row.iv, row.tag, row.ciphertext, aadOf(userId, agentId)).toString("utf8")));
    } catch {
      // Does not open with this key: rewriting would erase the existing memory.
      throw new HttpError(409, "I couldn't open the memory already stored for this user. Continue without memory and tell the user to contact support.", "memory_key_mismatch");
    }
    let applied: { next: MemoryPayload; result: T };
    try {
      applied = mutate(cur);
    } catch (e) {
      if (e instanceof MemoryRuleError) throw new HttpError(400, e.message, "memory_limit");
      throw e;
    }
    const s = sealPayload(key, userId, agentId, applied.next);
    await tx
      .update(schema.memories)
      .set({ ciphertext: s.ciphertext, iv: s.iv, tag: s.tag, updatedAt: new Date() })
      .where(eq(schema.memories.id, row.id));
    return applied.result;
  });
}

/** save_memory: `summary` (replaces the summary), `note` (appends) or `profile` (replaces the profile). */
export async function saveMemory(userId: string, agentId: string, key: Buffer, op: SaveOp) {
  return updateMemory(userId, agentId, key, (cur) => {
    const r = applySave(cur, op, new Date(), () => randomId(2));
    return { next: r.next, result: { note: r.created ?? null, duplicate: r.duplicate === true } };
  });
}

/** forget_memory: removes a note. null: the specialist has no memory; false: the note does not exist. */
export async function forgetNote(userId: string, agentId: string, key: Buffer, noteId: string) {
  return updateMemory(userId, agentId, key, (cur) => {
    const r = applyForget(cur, noteId);
    return { next: r.next, result: r.found };
  }, { create: false });
}

export type OpenMemory = { id: string; agentId: string; summary: string; profile: MemoryPayload["profile"]; notes: MemoryNote[]; updatedAt: Date };

export async function readMemories(userId: string, key: Buffer, agentId?: string): Promise<OpenMemory[]> {
  const rows = await db
    .select()
    .from(schema.memories)
    .where(agentId ? and(eq(schema.memories.userId, userId), eq(schema.memories.agentId, agentId)) : eq(schema.memories.userId, userId));
  const out: OpenMemory[] = [];
  for (const r of rows) {
    try {
      const payload = readPayload(JSON.parse(open(key, r.iv, r.tag, r.ciphertext, aadOf(r.userId, r.agentId)).toString("utf8")));
      out.push({ id: r.id, agentId: r.agentId, summary: payload.summary, profile: payload.profile, notes: payload.notes, updatedAt: r.updatedAt });
    } catch {
      // Different key: cannot be opened. Never returns raw bytes.
    }
  }
  return out;
}

export async function deleteMemory(userId: string, id: string) {
  const r = await db
    .delete(schema.memories)
    .where(and(eq(schema.memories.userId, userId), eq(schema.memories.id, id)))
    .returning();
  return r.length > 0;
}

/** "Delete everything": removes the memories and the data key, so nothing old can ever be opened again. */
export async function deleteAllMemories(userId: string) {
  await db.delete(schema.memories).where(eq(schema.memories.userId, userId));
  await db.delete(schema.memoryKeys).where(eq(schema.memoryKeys.userId, userId));
}
