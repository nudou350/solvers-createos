import { posix } from "node:path";

// Pure sandbox rules (no env/DB/network): output truncation, egress allowlist, workspace paths, timeouts and trial limits.

/** Everything the model writes or runs lives here. */
export const WORKSPACE = "/workspace";

/** Per stream (stdout, stderr) returned to the model. CreateOS exec itself cuts at 1 MiB. */
export const MAX_STREAM_BYTES = 16_384;
export const DEFAULT_TIMEOUT_MS = 60_000;
export const MAX_TIMEOUT_MS = 300_000;
/** Free trial: shorter runs (the run count itself is the trial gate of mcp/tools.ts, `trial.tools.sandbox_run`). */
export const TRIAL_MAX_TIMEOUT_MS = 120_000;
/** Step gate checks (`verify`) may install dependencies: the full cap. */
export const VERIFY_TIMEOUT_MS = 300_000;
/** CreateOS pauses an idle box after this (it keeps disk and memory; resume is fast). */
export const AUTO_PAUSE_SECONDS = 300;
/** The idle job destroys session boxes unused for longer than this. */
export const IDLE_DESTROY_MS = 30 * 60_000;
/** At the plan's concurrency cap, a box idle for this long may be reclaimed to serve a new one. */
export const RECLAIM_IDLE_MS = 5 * 60_000;

export const MAX_UPLOAD_FILES = 50;
export const MAX_UPLOAD_FILE_BYTES = 1_000_000;
export const MAX_UPLOAD_TOTAL_BYTES = 5_000_000;
export const MAX_COMMAND_LENGTH = 4_096;
export const MAX_ARGS = 100;
export const MAX_EGRESS_RULES = 32;

/** Package registries and source hosts; a Solver may add its own (`egressFor`). Any rule closes everything else. */
export const BASE_EGRESS: readonly string[] = [
  "registry.npmjs.org:443",
  "pypi.org:443",
  "*.pythonhosted.org:443",
  "github.com:443",
  "*.githubusercontent.com:443",
];

/** Verifier boxes only install npm packages. */
export const VERIFIER_EGRESS: readonly string[] = ["registry.npmjs.org:443"];

const EGRESS_RULE = /^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+:([1-9][0-9]{0,4})$/;

export function isEgressRule(rule: string): boolean {
  const m = EGRESS_RULE.exec(rule);
  return !!m && Number(m[6]) <= 65_535;
}

/** Base allowlist plus the Solver's extras: lowercased, validated, deduplicated and capped. Never empty (empty = open). */
export function egressFor(extras: readonly string[] = []): string[] {
  const out = new Set(BASE_EGRESS);
  for (const raw of extras) {
    const rule = raw.trim().toLowerCase();
    if (!isEgressRule(rule)) throw new Error(`Invalid egress rule: ${raw} (use host:port, e.g. api.example.com:443)`);
    out.add(rule);
  }
  if (out.size > MAX_EGRESS_RULES) throw new Error(`At most ${MAX_EGRESS_RULES} egress rules`);
  return [...out];
}

export type Truncated = { text: string; truncated: boolean };

/**
 * Keeps at most `max` bytes: the head (what started) and the longer tail (where errors usually are), with a marker in
 * between. Cuts on UTF-8 boundaries so no half character reaches the model.
 */
export function truncateOutput(s: string, max = MAX_STREAM_BYTES): Truncated {
  const buf = Buffer.from(s, "utf8");
  if (buf.length <= max) return { text: s, truncated: false };
  const head = Math.floor(max / 4);
  const tail = max - head;
  const marker = `\n… [${buf.length - head - tail} bytes truncated] …\n`;
  return { text: utf8Head(buf, head) + marker + utf8Tail(buf, tail), truncated: true };
}

function utf8Head(buf: Buffer, n: number): string {
  let end = n;
  while (end > 0 && (buf[end]! & 0xc0) === 0x80) end--;
  return buf.subarray(0, end).toString("utf8");
}

function utf8Tail(buf: Buffer, n: number): string {
  let start = buf.length - n;
  while (start < buf.length && (buf[start]! & 0xc0) === 0x80) start++;
  return buf.subarray(start).toString("utf8");
}

/**
 * Resolves a path given by the model to an absolute path inside /workspace (relative paths are relative to it).
 * Rejects escapes (`..`), NUL bytes and the workspace root itself as a file target.
 */
export function workspacePath(p: string): string {
  if (typeof p !== "string" || p.trim() === "" || p.includes("\0")) throw new Error("Invalid path");
  const raw = p.replace(/\\/g, "/");
  const abs = posix.normalize(raw.startsWith("/") ? raw : `${WORKSPACE}/${raw}`);
  if (!abs.startsWith(`${WORKSPACE}/`) || abs.length <= WORKSPACE.length + 1) throw new Error(`Path must be inside ${WORKSPACE}: ${p}`);
  return abs.replace(/\/+$/, "");
}

export type UploadFile = { path: string; content: string };

/** Validates and resolves the files of a sandbox_run; returns them with absolute paths. */
export function checkUploads(files: readonly UploadFile[]): UploadFile[] {
  if (files.length > MAX_UPLOAD_FILES) throw new Error(`At most ${MAX_UPLOAD_FILES} files per call`);
  let total = 0;
  const seen = new Set<string>();
  return files.map((f) => {
    const path = workspacePath(f.path);
    if (seen.has(path)) throw new Error(`Duplicate file: ${f.path}`);
    seen.add(path);
    const size = Buffer.byteLength(f.content, "utf8");
    if (size > MAX_UPLOAD_FILE_BYTES) throw new Error(`File too large (max. 1 MB): ${f.path}`);
    total += size;
    if (total > MAX_UPLOAD_TOTAL_BYTES) throw new Error("Files too large in total (max. 5 MB per call)");
    return { path, content: f.content };
  });
}

export function checkCommand(command: string, args: readonly string[]): void {
  if (!command.trim() || command.includes("\0") || command.length > MAX_COMMAND_LENGTH) throw new Error("Invalid command");
  if (args.length > MAX_ARGS) throw new Error(`At most ${MAX_ARGS} arguments`);
  let total = command.length;
  for (const a of args) {
    if (a.includes("\0")) throw new Error("Invalid argument (NUL byte)");
    total += a.length;
  }
  if (total > 64_000) throw new Error("Command line too long");
}

export function checkPort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("Invalid port (1–65535)");
}

/** Requested timeout, defaulted and capped (lower cap during a free trial). */
export function clampTimeout(ms: number | undefined, trial = false): number {
  const cap = trial ? TRIAL_MAX_TIMEOUT_MS : MAX_TIMEOUT_MS;
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return Math.min(DEFAULT_TIMEOUT_MS, cap);
  return Math.min(Math.max(1_000, Math.floor(ms)), cap);
}

export function isIdle(lastUsedAt: Date, now: Date, idleMs = IDLE_DESTROY_MS): boolean {
  return now.getTime() - lastUsedAt.getTime() > idleMs;
}

export type RunView = { stdout: string; stderr: string; exit_code: number; exec_ms: number; truncated: boolean };

/** What the model receives for one run. */
export function runView(r: { stdout: string; stderr: string; exitCode: number; execMs: number }): RunView {
  const out = truncateOutput(r.stdout);
  const err = truncateOutput(r.stderr);
  return { stdout: out.text, stderr: err.text, exit_code: r.exitCode, exec_ms: r.execMs, truncated: out.truncated || err.truncated };
}

/** Human text for capacity errors (no plan names or vendor jargon for the end user). */
export const QUOTA_TEXT = "All code sandboxes are busy right now (capacity limit reached). Wait a minute and try again.";
