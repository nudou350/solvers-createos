import { randomUUID } from "node:crypto";
import { SandboxError, type BoxInfo, type CreateSpec, type ForkSpec, type RunOptions, type RunOutput, type SandboxPort } from "./client.js";
import type { RunLog, SandboxRow, SandboxRowStatus, SandboxStore } from "./pool.js";

// In-memory SandboxPort for tests and SANDBOX_MODE=simulated. Nothing is executed: commands get canned, deterministic
// results (a few builtins, responders registered by tests, else exit 0 with a "[simulated]" line). It follows the
// CreateOS rules that matter to the pool: a concurrency cap (paused boxes count), fork only from a paused box.

type FakeBox = { id: string; status: "running" | "paused" | "destroyed"; ingress: boolean; egress: readonly string[]; files: Map<string, string>; forkedFrom?: string };

export type Responder = (cmd: string, args: readonly string[], opts: RunOptions) => Partial<RunOutput> | undefined;

export type FakeOptions = {
  /** Live (running or paused) boxes allowed at once; creating past it fails with `quota` (CreateOS answers 429). */
  maxConcurrent?: number;
  /** false: fork fails with `quota`, as on the Free plan where the fork needs a second slot. */
  forkSupported?: boolean;
};

export class FakeSandboxPort implements SandboxPort {
  readonly mode = "simulated" as const;
  readonly boxes = new Map<string, FakeBox>();
  readonly calls: { op: string; id?: string; cmd?: string; args?: readonly string[] }[] = [];
  created = 0;
  private responders: Responder[] = [];
  private seq = 0;

  constructor(private opts: FakeOptions = {}) {}

  /** Registers a canned answer; the first responder that returns something wins. */
  respond(fn: Responder): this {
    this.responders.push(fn);
    return this;
  }

  live(): FakeBox[] {
    return [...this.boxes.values()].filter((b) => b.status !== "destroyed");
  }

  private box(id: string): FakeBox {
    const b = this.boxes.get(id);
    if (!b || b.status === "destroyed") throw new SandboxError("not_found", `Sandbox ${id} not found`);
    return b;
  }

  private running(id: string): FakeBox {
    const b = this.box(id);
    if (b.status !== "running") throw new SandboxError("invalid_state", `Sandbox ${id} is ${b.status}`);
    return b;
  }

  private add(b: Omit<FakeBox, "id">): FakeBox {
    if (this.live().length >= (this.opts.maxConcurrent ?? Infinity)) throw new SandboxError("quota", "sandbox quota reached (simulated)");
    const box = { ...b, id: `sim-${++this.seq}-${randomUUID().slice(0, 8)}` };
    this.boxes.set(box.id, box);
    return box;
  }

  private info(b: FakeBox): BoxInfo {
    return { id: b.id, status: b.status, ingress: b.ingress, forkedFrom: b.forkedFrom };
  }

  async create(spec: CreateSpec): Promise<BoxInfo> {
    this.calls.push({ op: "create" });
    const b = this.add({ status: "running", ingress: spec.ingress ?? false, egress: [...spec.egress], files: new Map() });
    this.created++;
    return this.info(b);
  }

  async connect(id: string): Promise<BoxInfo> {
    this.calls.push({ op: "connect", id });
    const b = this.box(id);
    b.status = "running";
    return this.info(b);
  }

  async run(id: string, cmd: string, args: string[], opts: RunOptions): Promise<RunOutput> {
    this.calls.push({ op: "run", id, cmd, args });
    const b = this.running(id);
    for (const r of this.responders) {
      const out = r(cmd, args, opts);
      if (out) return { stdout: "", stderr: "", exitCode: 0, execMs: 1, ...out };
    }
    return builtin(b, cmd, args);
  }

  async spawn(id: string, cmd: string, args: string[]): Promise<{ processId: string }> {
    this.calls.push({ op: "spawn", id, cmd, args });
    this.running(id);
    return { processId: `proc-${++this.seq}` };
  }

  async upload(id: string, path: string, data: string | Uint8Array): Promise<void> {
    this.calls.push({ op: "upload", id, cmd: path });
    this.running(id).files.set(path, typeof data === "string" ? data : new TextDecoder().decode(data));
  }

  async download(id: string, path: string): Promise<Uint8Array> {
    const content = this.running(id).files.get(path);
    if (content == null) throw new SandboxError("not_found", `No such file: ${path}`);
    return new TextEncoder().encode(content);
  }

  async preview(id: string, port: number): Promise<string> {
    this.calls.push({ op: "preview", id });
    const b = this.running(id);
    b.ingress = true;
    return `https://${b.id}-${port}.simulated.invalid`;
  }

  async pause(id: string): Promise<void> {
    this.calls.push({ op: "pause", id });
    this.box(id).status = "paused";
  }

  async resume(id: string): Promise<void> {
    this.calls.push({ op: "resume", id });
    this.box(id).status = "running";
  }

  async fork(id: string, spec: ForkSpec = {}): Promise<BoxInfo> {
    this.calls.push({ op: "fork", id });
    const src = this.box(id);
    if (src.status !== "paused") throw new SandboxError("invalid_state", "source sandbox must be paused");
    if (this.opts.forkSupported === false) throw new SandboxError("quota", "sandbox quota reached (simulated)");
    const b = this.add({
      status: spec.startPaused ? "paused" : "running",
      ingress: spec.ingress ?? src.ingress,
      egress: spec.egress ?? src.egress,
      files: new Map(src.files),
      forkedFrom: src.id,
    });
    return this.info(b);
  }

  async destroy(id: string): Promise<void> {
    this.calls.push({ op: "destroy", id });
    const b = this.boxes.get(id);
    if (b) b.status = "destroyed";
  }

  async list(): Promise<BoxInfo[]> {
    return this.live().map((b) => this.info(b));
  }
}

const ok = (stdout: string): RunOutput => ({ stdout, stderr: "", exitCode: 0, execMs: 1 });

function builtin(b: FakeBox, cmd: string, args: readonly string[]): RunOutput {
  if (cmd === "true") return ok("");
  if (cmd === "false") return { ...ok(""), exitCode: 1 };
  if (cmd === "node" && args[0] === "-v") return ok("v24.0.0\n");
  if (cmd === "python3" && args[0] === "--version") return ok("Python 3.13.0\n");
  if (cmd === "cat" && args.length === 1) {
    const f = b.files.get(args[0]!);
    return f == null ? { stdout: "", stderr: `cat: ${args[0]}: No such file or directory\n`, exitCode: 1, execMs: 1 } : ok(f);
  }
  const exit = cmd === "bash" && args[0] === "-lc" ? /^\s*exit\s+(\d+)\s*$/.exec(args[1] ?? "") : null;
  if (exit) return { ...ok(""), exitCode: Number(exit[1]) };
  return ok(`[simulated] ${[cmd, ...args].join(" ")}\n`);
}

/** In-memory `sandboxes` / `sandbox_runs`. */
export class MemorySandboxStore implements SandboxStore {
  readonly rows = new Map<string, SandboxRow>();
  readonly runs: RunLog[] = [];

  constructor(private now: () => Date = () => new Date()) {}

  async active(userId: string, sessionId: string) {
    const all = [...this.rows.values()].filter((r) => r.userId === userId && r.sessionId === sessionId && r.status === "active");
    return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
  }

  async get(id: string) {
    return this.rows.get(id) ?? null;
  }

  async list(userId: string, sessionId: string, status: SandboxRowStatus) {
    return [...this.rows.values()].filter((r) => r.userId === userId && r.sessionId === sessionId && r.status === status);
  }

  async insert(row: { id?: string; userId: string; sessionId: string | null; createosId: string | null; status: SandboxRowStatus }) {
    const t = this.now();
    const created: SandboxRow = { id: row.id ?? randomUUID(), userId: row.userId, sessionId: row.sessionId, createosId: row.createosId, status: row.status, createdAt: t, lastUsedAt: t, runs: 0 };
    this.rows.set(created.id, created);
    return created;
  }

  async update(id: string, patch: { status?: SandboxRowStatus; lastUsedAt?: Date; addRuns?: number }) {
    const r = this.rows.get(id);
    if (!r) return;
    if (patch.status) r.status = patch.status;
    if (patch.lastUsedAt) r.lastUsedAt = patch.lastUsedAt;
    if (patch.addRuns) r.runs += patch.addRuns;
  }

  async idle(before: Date) {
    return [...this.rows.values()].filter((r) => r.status !== "destroyed" && r.lastUsedAt < before).sort((a, b) => a.lastUsedAt.getTime() - b.lastUsedAt.getTime());
  }

  async logRun(r: RunLog) {
    this.runs.push(r);
  }
}
