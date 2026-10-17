import { randomUUID } from "node:crypto";
import { posix } from "node:path";
import { HttpError } from "../lib/http.js";
import { withKeyLock } from "../verifier/lock.js";
import { toSandboxError, type BoxInfo, type CreateSpec, type RunOptions, type RunOutput, type SandboxPort } from "./client.js";
import { AUTO_PAUSE_SECONDS, egressFor, IDLE_DESTROY_MS, QUOTA_TEXT, RECLAIM_IDLE_MS, WORKSPACE, type UploadFile } from "./rules.js";

// One CreateOS sandbox per (user, session), recorded in `sandboxes`. A later call reconnects to it (resuming it when
// CreateOS auto-paused it); a lost box is replaced. Checkpoints are paused forks of the session box (row status
// "checkpoint"), or, where the plan cannot fork (Free: 1 concurrent box), a tarball of /workspace inside the box ("snapshot").
// No database import here: the store is injected (store.ts in the server, an in-memory one in tests).

export type SandboxRowStatus = "active" | "checkpoint" | "snapshot" | "destroyed";

export type SandboxRow = {
  id: string;
  userId: string;
  sessionId: string | null;
  createosId: string | null;
  status: string;
  createdAt: Date;
  lastUsedAt: Date;
  runs: number;
};

export type RunKind = "run" | "verify" | "preview";

export type RunLog = {
  sandboxId: string | null;
  userId: string;
  agentId: string | null;
  command: string;
  exitCode: number | null;
  execMs: number | null;
  stdoutBytes: number;
  kind: RunKind;
};

export interface SandboxStore {
  active(userId: string, sessionId: string): Promise<SandboxRow | null>;
  /** The user's most recent active box from any session (reused by a new session instead of creating one). */
  latestActive(userId: string): Promise<SandboxRow | null>;
  get(id: string): Promise<SandboxRow | null>;
  list(userId: string, sessionId: string, status: SandboxRowStatus): Promise<SandboxRow[]>;
  insert(row: { id?: string; userId: string; sessionId: string | null; createosId: string | null; status: SandboxRowStatus }): Promise<SandboxRow>;
  update(id: string, patch: { status?: SandboxRowStatus; sessionId?: string; lastUsedAt?: Date; addRuns?: number }): Promise<void>;
  /** Rows not destroyed and unused since `before`, longest idle first. */
  idle(before: Date): Promise<SandboxRow[]>;
  logRun(r: RunLog): Promise<void>;
}

/** The session box a call works on. */
export type Lease = { row: SandboxRow; boxId: string };

export type RunMeta = { userId: string; agentId: string | null; kind: RunKind };

export type CheckpointMethod = "fork" | "snapshot";

/** Snapshots live outside /workspace, so restoring the workspace never deletes them. */
const SNAPSHOT_DIR = "/var/tmp/solvers-checkpoints";
/** After the plan refuses a fork, use snapshots for a while instead of pausing the box for nothing. */
const FORK_RETRY_MS = 10 * 60_000;

/** Saves /workspace as a tarball in the box (Free-plan checkpoint). */
export const snapshotScript = (id: string) => `mkdir -p ${SNAPSHOT_DIR} && tar -czf ${SNAPSHOT_DIR}/${id}.tgz -C ${WORKSPACE} .`;
/** Readies a box for a new session: stops leftover app processes, empties /workspace and drops old snapshots. */
export const resetScript = `pkill -x node; pkill -x npm; pkill -x bun; find ${WORKSPACE} -mindepth 1 -delete; rm -rf ${SNAPSHOT_DIR} /tmp/solvers-*.log; mkdir -p ${WORKSPACE}`;
/** Empties /workspace and unpacks the tarball back into it. */
export const restoreScript = (id: string) => `find ${WORKSPACE} -mindepth 1 -delete && tar -xzf ${SNAPSHOT_DIR}/${id}.tgz -C ${WORKSPACE}`;

/** Sandbox failures as user-facing HTTP errors (null: not a sandbox capacity/availability problem). */
export function sandboxHttpError(e: unknown): HttpError | null {
  if (e instanceof HttpError) return e;
  const err = toSandboxError(e);
  switch (err.code) {
    case "quota":
      return new HttpError(429, QUOTA_TEXT, "sandbox_quota");
    case "payment":
    case "auth":
      return new HttpError(503, "Code sandboxes are unavailable on this server right now. Try again later.", "sandbox_unavailable");
    case "unavailable":
    case "timeout":
      return new HttpError(503, "The code sandbox did not answer in time. Try again in a moment.", "sandbox_unavailable");
    default:
      return null;
  }
}

/** Display form of a command for the run log (argv joined; long arguments shortened). */
export function commandLine(cmd: string, args: readonly string[]): string {
  return [cmd, ...args].map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : JSON.stringify(a.length > 200 ? `${a.slice(0, 200)}…` : a))).join(" ").slice(0, 2_000);
}

export type Pool = ReturnType<typeof createPool>;

export function createPool(deps: { port: SandboxPort; store: SandboxStore; now?: () => Date }) {
  const { port, store } = deps;
  const now = deps.now ?? (() => new Date());
  const ago = (ms: number) => new Date(now().getTime() - ms);
  let forkBlockedUntil = 0;

  async function logRun(r: RunLog): Promise<void> {
    // The answer never depends on the log, but a failure is never silent.
    await store.logRun(r).catch((e) => console.error(`[sandbox] failed to write sandbox_runs (kind=${r.kind})`, e));
  }

  async function destroyRow(row: SandboxRow): Promise<void> {
    if (row.createosId && row.status !== "snapshot") await port.destroy(row.createosId);
    await store.update(row.id, { status: "destroyed" });
  }

  /** Creates a box. At the plan's concurrency cap (429), reclaims the longest-idle box once and retries. */
  async function createBox(spec: CreateSpec): Promise<BoxInfo> {
    try {
      return await port.create(spec);
    } catch (e) {
      if (toSandboxError(e).code !== "quota") throw e;
      const victim = (await store.idle(ago(RECLAIM_IDLE_MS))).find((r) => r.createosId && r.status !== "snapshot");
      if (!victim) throw e;
      console.warn(`[sandbox] at capacity: reclaiming idle sandbox ${victim.id}`);
      await destroyRow(victim);
      return port.create(spec);
    }
  }

  /**
   * A new session takes over the user's box from an earlier session instead of creating one (each creation counts
   * against the plan's daily quota). The box is reset first: leftover app processes stopped, /workspace and old
   * snapshots emptied, so the new session starts clean.
   */
  async function adopt(userId: string, sessionId: string): Promise<Lease | null> {
    const prev = await store.latestActive(userId);
    if (!prev?.createosId) return null;
    try {
      await port.connect(prev.createosId);
      const reset = await port.run(prev.createosId, "bash", ["-lc", `${resetScript}; true`], { timeoutMs: 60_000 });
      if (reset.exitCode !== 0) return null;
    } catch (e) {
      if (toSandboxError(e).code !== "not_found") throw e;
      await store.update(prev.id, { status: "destroyed" });
      return null;
    }
    await store.update(prev.id, { sessionId, lastUsedAt: now() });
    return { row: { ...prev, sessionId }, boxId: prev.createosId };
  }

  /** The session's box: reconnects (resuming a paused one), takes over the user's earlier box, or creates one. */
  function session(userId: string, sessionId: string, egressExtras: readonly string[] = []): Promise<Lease> {
    return withKeyLock(`sandbox:${userId}:${sessionId}`, async () => {
      const row = await store.active(userId, sessionId);
      if (row?.createosId) {
        try {
          await port.connect(row.createosId);
          await store.update(row.id, { lastUsedAt: now() });
          return { row, boxId: row.createosId };
        } catch (e) {
          if (toSandboxError(e).code !== "not_found") throw e;
          await store.update(row.id, { status: "destroyed" });
        }
      }
      const adopted = await adopt(userId, sessionId);
      if (adopted) return adopted;
      const box = await createBox({ egress: egressFor(egressExtras), ingress: true, autoPauseSeconds: AUTO_PAUSE_SECONDS });
      try {
        await port.run(box.id, "mkdir", ["-p", WORKSPACE], { timeoutMs: 30_000 });
        const created = await store.insert({ userId, sessionId, createosId: box.id, status: "active" });
        return { row: created, boxId: box.id };
      } catch (e) {
        await port.destroy(box.id).catch(() => undefined);
        throw e;
      }
    });
  }

  async function run(lease: Lease, cmd: string, args: string[], opts: RunOptions, meta: RunMeta): Promise<RunOutput> {
    const out = await port.run(lease.boxId, cmd, args, opts);
    await store.update(lease.row.id, { lastUsedAt: now(), addRuns: 1 }).catch(() => undefined);
    await logRun({
      sandboxId: lease.row.id,
      userId: meta.userId,
      agentId: meta.agentId,
      command: commandLine(cmd, args),
      exitCode: out.exitCode,
      execMs: out.execMs,
      stdoutBytes: Buffer.byteLength(out.stdout),
      kind: meta.kind,
    });
    return out;
  }

  /** Writes files (absolute paths already checked by rules.checkUploads), creating their folders first. */
  async function upload(lease: Lease, files: readonly UploadFile[]): Promise<void> {
    if (files.length === 0) return;
    const dirs = [...new Set(files.map((f) => posix.dirname(f.path)))];
    const mk = await port.run(lease.boxId, "mkdir", ["-p", "--", ...dirs], { timeoutMs: 30_000 });
    if (mk.exitCode !== 0) throw new HttpError(400, `Could not create the folders: ${mk.stderr.slice(-500)}`);
    for (const f of files) await port.upload(lease.boxId, f.path, f.content);
  }

  /** Starts a long-lived process in /workspace; returns at once with its id and log file. */
  async function spawn(lease: Lease, cmd: string, args: string[], meta: RunMeta): Promise<{ processId: string; logPath: string }> {
    const logPath = `/tmp/solvers-${Date.now().toString(36)}.log`;
    const { processId } = await port.spawn(lease.boxId, cmd, args, { cwd: WORKSPACE, logPath });
    await store.update(lease.row.id, { lastUsedAt: now(), addRuns: 1 }).catch(() => undefined);
    await logRun({ sandboxId: lease.row.id, userId: meta.userId, agentId: meta.agentId, command: `[background] ${commandLine(cmd, args)}`, exitCode: null, execMs: null, stdoutBytes: 0, kind: meta.kind });
    return { processId, logPath };
  }

  async function preview(lease: Lease, guestPort: number, meta: RunMeta): Promise<string> {
    const t0 = Date.now();
    const url = await port.preview(lease.boxId, guestPort, { waitMs: 30_000 });
    await logRun({ sandboxId: lease.row.id, userId: meta.userId, agentId: meta.agentId, command: `preview :${guestPort}`, exitCode: 0, execMs: Date.now() - t0, stdoutBytes: 0, kind: "preview" });
    return url;
  }

  /** Pauses the session box, forks it (the paused fork is the checkpoint) and resumes it. Keeps only the newest fork. */
  async function forkCheckpoint(lease: Lease, userId: string, sessionId: string): Promise<SandboxRow> {
    await port.pause(lease.boxId);
    let fork: BoxInfo;
    try {
      fork = await port.fork(lease.boxId, { startPaused: true });
    } finally {
      await port.resume(lease.boxId);
    }
    const row = await store.insert({ userId, sessionId, createosId: fork.id, status: "checkpoint" });
    // Every paused fork holds a slot of the plan's concurrency: older checkpoints of the session go.
    for (const old of await store.list(userId, sessionId, "checkpoint")) {
      if (old.id !== row.id) await destroyRow(old).catch((e) => console.warn(`[sandbox] could not drop checkpoint ${old.id}`, e));
    }
    return row;
  }

  function checkpoint(userId: string, sessionId: string): Promise<{ checkpointId: string; method: CheckpointMethod }> {
    return withKeyLock(`sandbox-op:${userId}:${sessionId}`, async () => {
      const lease = await session(userId, sessionId);
      if (Date.now() >= forkBlockedUntil) {
        try {
          const row = await forkCheckpoint(lease, userId, sessionId);
          return { checkpointId: row.id, method: "fork" as const };
        } catch (e) {
          const code = toSandboxError(e).code;
          if (code !== "quota" && code !== "payment" && code !== "unavailable" && code !== "invalid_state") throw e;
          forkBlockedUntil = Date.now() + FORK_RETRY_MS;
          console.warn(`[sandbox] fork refused (${code}): checkpoints fall back to workspace snapshots`);
        }
      }
      const id = randomUUID();
      const r = await port.run(lease.boxId, "bash", ["-lc", snapshotScript(id)], { timeoutMs: 120_000 });
      if (r.exitCode !== 0) throw new HttpError(500, `Could not save the checkpoint: ${r.stderr.slice(-500)}`);
      await store.insert({ id, userId, sessionId, createosId: lease.boxId, status: "snapshot" });
      return { checkpointId: id, method: "snapshot" as const };
    });
  }

  function restore(userId: string, sessionId: string, checkpointId: string): Promise<{ method: CheckpointMethod; reusable: boolean }> {
    return withKeyLock(`sandbox-op:${userId}:${sessionId}`, async () => {
      const cp = await store.get(checkpointId);
      if (!cp || cp.userId !== userId || cp.sessionId !== sessionId || !cp.createosId || (cp.status !== "checkpoint" && cp.status !== "snapshot")) {
        throw new HttpError(404, "Unknown checkpoint for this session: use a checkpoint_id returned by sandbox_checkpoint.", "checkpoint_not_found");
      }
      if (cp.status === "snapshot") {
        const lease = await session(userId, sessionId);
        if (lease.boxId !== cp.createosId) throw new HttpError(409, "That checkpoint belonged to a sandbox that no longer exists. Take a new checkpoint.", "checkpoint_gone");
        const r = await port.run(lease.boxId, "bash", ["-lc", restoreScript(cp.id)], { timeoutMs: 120_000 });
        if (r.exitCode !== 0) throw new HttpError(500, `Could not restore the checkpoint: ${r.stderr.slice(-500)}`);
        await store.update(lease.row.id, { lastUsedAt: now() });
        return { method: "snapshot" as const, reusable: true };
      }
      const cpBox = cp.createosId;
      // Fork checkpoint: the session box is replaced by a fresh fork of the frozen copy, so the checkpoint stays reusable.
      return withKeyLock(`sandbox:${userId}:${sessionId}`, async () => {
        const current = await store.active(userId, sessionId);
        if (current) await destroyRow(current); // frees a slot of the plan before forking
        try {
          const box = await port.fork(cpBox, { startPaused: false });
          await store.insert({ userId, sessionId, createosId: box.id, status: "active" });
          await store.update(cp.id, { lastUsedAt: now() });
          return { method: "fork" as const, reusable: true };
        } catch (e) {
          const code = toSandboxError(e).code;
          if (code === "not_found") {
            await store.update(cp.id, { status: "destroyed" });
            throw new HttpError(410, "That checkpoint expired (idle sandboxes are cleaned up). Take a new checkpoint.", "checkpoint_gone");
          }
          if (code !== "quota") throw e;
          // No slot for a second copy: the checkpoint itself becomes the session box (restorable only once).
          await port.resume(cpBox);
          await store.update(cp.id, { status: "active", lastUsedAt: now() });
          return { method: "fork" as const, reusable: false };
        }
      });
    });
  }

  /** Short-lived box outside any session (the verifier): always destroyed, even when `fn` throws. */
  async function ephemeral<T>(spec: CreateSpec, fn: (boxId: string) => Promise<T>): Promise<T> {
    const box = await createBox(spec);
    try {
      return await fn(box.id);
    } finally {
      await port.destroy(box.id).catch((e) => console.error(`[sandbox] could not destroy ephemeral sandbox ${box.id}`, e));
    }
  }

  /** Destroys boxes nobody used for IDLE_DESTROY_MS. Returns how many CreateOS sandboxes were destroyed. */
  async function destroyIdle(): Promise<number> {
    let n = 0;
    for (const row of await store.idle(ago(IDLE_DESTROY_MS))) {
      try {
        await destroyRow(row);
        if (row.createosId && row.status !== "snapshot") n++;
      } catch (e) {
        console.error(`[sandbox] could not destroy idle sandbox ${row.id}`, e);
      }
    }
    return n;
  }

  return { port, store, session, run, upload, spawn, preview, checkpoint, restore, ephemeral, destroyIdle };
}
