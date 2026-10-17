import {
  CreateosSandboxApiError,
  CreateosSandboxClient,
  CreateosSandboxConnectionError,
  CreateosSandboxTimeoutError,
  type Sandbox,
} from "@nodeops-createos/sandbox";
import { sandboxConfig, type SandboxConfig, type SandboxMode } from "./config.js";

// Thin wrapper over @nodeops-createos/sandbox. Everything else in the server talks to `SandboxPort` (by sandbox id), so
// tests and SANDBOX_MODE=simulated swap in the in-memory fake (fake.ts). SDK errors become `SandboxError` with a code.

export type BoxInfo = {
  id: string;
  /** CreateOS lifecycle: creating | running | pausing | paused | resuming | forking | error | destroying | destroyed | failed. */
  status: string;
  ingress: boolean;
  forkedFrom?: string;
};

export type CreateSpec = {
  /** `host:port` allow rules; with any rule, everything else is denied. */
  egress: readonly string[];
  ingress?: boolean;
  /** Idle seconds before CreateOS pauses the box (60–86400). */
  autoPauseSeconds?: number;
  /** At most 22 characters, unique per account. */
  name?: string;
};

export type ForkSpec = { startPaused?: boolean; ingress?: boolean; egress?: readonly string[] };

export type RunOptions = { timeoutMs: number; cwd?: string; stdin?: string };

export type RunOutput = { stdout: string; stderr: string; exitCode: number; execMs: number; timedOut?: boolean };

export interface SandboxPort {
  readonly mode: SandboxMode;
  create(spec: CreateSpec): Promise<BoxInfo>;
  /** Attaches to an existing box and makes sure it is running (resumes a paused one). */
  connect(id: string): Promise<BoxInfo>;
  run(id: string, cmd: string, args: string[], opts: RunOptions): Promise<RunOutput>;
  /** Starts a long-lived process (e.g. an app server) and returns at once; stdout+stderr go to `logPath`. */
  spawn(id: string, cmd: string, args: string[], opts: { cwd?: string; logPath: string }): Promise<{ processId: string }>;
  upload(id: string, path: string, data: string | Uint8Array): Promise<void>;
  download(id: string, path: string): Promise<Uint8Array>;
  /** Public URL of an in-guest port (turns ingress on when needed and waits for the port). */
  preview(id: string, port: number, opts?: { waitMs?: number }): Promise<string>;
  pause(id: string): Promise<void>;
  resume(id: string): Promise<void>;
  /** Clones a box; the source must be paused (CreateOS rule). */
  fork(id: string, spec?: ForkSpec): Promise<BoxInfo>;
  /** Idempotent: an unknown or already destroyed box is not an error. */
  destroy(id: string): Promise<void>;
  /** Boxes that still exist (not destroyed). */
  list(): Promise<BoxInfo[]>;
}

export type SandboxErrorCode = "quota" | "payment" | "not_found" | "invalid_state" | "unavailable" | "timeout" | "auth" | "error";

export class SandboxError extends Error {
  constructor(
    public code: SandboxErrorCode,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "SandboxError";
  }
}

/** Maps SDK/HTTP failures to a small set of codes the pool and the tools can act on. */
export function toSandboxError(e: unknown): SandboxError {
  if (e instanceof SandboxError) return e;
  if (e instanceof CreateosSandboxTimeoutError) return new SandboxError("timeout", e.message);
  if (e instanceof CreateosSandboxConnectionError) return new SandboxError("unavailable", e.message);
  if (e instanceof CreateosSandboxApiError) {
    const retry = (e as { retryAfterSeconds?: number }).retryAfterSeconds;
    switch (e.statusCode) {
      case 400:
        return new SandboxError("invalid_state", e.message);
      case 401:
        return new SandboxError("auth", e.message);
      case 402:
        return new SandboxError("payment", e.message);
      case 403:
        return new SandboxError(/quota|limit/i.test(e.message) ? "quota" : "auth", e.message);
      case 404:
        return new SandboxError("not_found", e.message);
      case 409:
        return new SandboxError("invalid_state", e.message);
      case 429:
        return new SandboxError("quota", e.message, retry);
      case 503:
        return new SandboxError("unavailable", e.message, retry);
    }
    return new SandboxError("error", e.message);
  }
  return new SandboxError("error", e instanceof Error ? e.message : String(e));
}

async function mapped<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw toSandboxError(e);
  }
}

const info = (s: Sandbox): BoxInfo => ({ id: s.id, status: s.status, ingress: s.data.ingress_enabled, forkedFrom: s.data.forked_from });

/**
 * Runs `cmd args` inside `cwd`, killed by coreutils `timeout` in the guest (exit 124): aborting the HTTP request alone
 * would leave the process running in the box. Arguments travel as argv, never through a shell string.
 */
export function guestCommand(cmd: string, args: string[], opts: RunOptions): { cmd: string; args: string[] } {
  const secs = Math.max(1, Math.ceil(opts.timeoutMs / 1000));
  const script = 'cd -- "$1" || exit 1; shift; secs="$1"; shift; exec timeout -k 5 "$secs" "$@"';
  return { cmd: "bash", args: ["-lc", script, "bash", opts.cwd ?? "/", String(secs), cmd, ...args] };
}

const WAIT_MS = 120_000;

/**
 * Resolves with the promise's value, or null once `ms` elapse; a late failure of the abandoned promise is swallowed.
 * A failure before the deadline still rejects.
 */
export function withDeadline<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  p.catch(() => undefined);
  return Promise.race([p, deadline]).finally(() => clearTimeout(timer));
}

/**
 * CreateOS auto-pauses a box after AUTO_PAUSE idle seconds, and an open exec does not count as activity: a call can
 * land on a box that paused under it (409 "sandbox is paused"). Resume it and try once more.
 */
async function whenPausedResume<T>(s: Sandbox, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const err = toSandboxError(e);
    if (err.code !== "invalid_state" || !/paused/i.test(err.message)) throw e;
    await s.refresh();
    if (s.status === "pausing") await s.waitUntilPaused({ timeoutMs: WAIT_MS });
    if (s.status !== "running" && s.status !== "resuming") await s.resume();
    await s.waitUntilRunning({ timeoutMs: WAIT_MS });
    return fn();
  }
}

export function createosPort(cfg: SandboxConfig = sandboxConfig()): SandboxPort {
  if (!cfg.apiKey) throw new SandboxError("auth", "CREATEOS_SANDBOX_API_KEY is not set.");
  const client = new CreateosSandboxClient({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, timeoutMs: 60_000 });
  const handles = new Map<string, Sandbox>();

  const handle = async (id: string): Promise<Sandbox> => {
    const known = handles.get(id);
    if (known) return known;
    const s = await mapped(() => client.getSandbox(id));
    handles.set(id, s);
    return s;
  };

  return {
    mode: "createos",

    create: (spec) =>
      mapped(async () => {
        const s = await client.createSandbox({
          shape: cfg.shape,
          rootfs: cfg.rootfs,
          egress: [...spec.egress],
          ingress_enabled: spec.ingress ?? false,
          auto_pause_after_seconds: spec.autoPauseSeconds,
          name: spec.name,
        });
        handles.set(s.id, s);
        return info(s);
      }),

    connect: (id) =>
      mapped(async () => {
        const s = await client.getSandbox(id);
        handles.set(id, s);
        if (s.status === "destroying" || s.status === "destroyed" || s.status === "failed") throw new SandboxError("not_found", `Sandbox ${id} is ${s.status}.`);
        if (s.status === "pausing") await s.waitUntilPaused({ timeoutMs: WAIT_MS });
        if (s.status === "paused" || s.status === "error") await s.resume();
        if (s.status !== "running") await s.waitUntilRunning({ timeoutMs: WAIT_MS });
        return info(s);
      }),

    run: async (id, cmd, args, opts) => {
      const s = await handle(id);
      const g = guestCommand(cmd, args, opts);
      const t0 = Date.now();
      const exec = () => {
        // The exec stream stays open while ANY process it started lives (e.g. `npm start &`), and neither the SDK's
        // request timeout nor an abort signal ends the streamed body (seen live: 460 s for a 5 s command, until the box
        // auto-paused). Only the race bounds the call; the signal still frees the socket when the SDK honors it.
        // Never retried (not idempotent).
        const signal = AbortSignal.timeout(opts.timeoutMs + 20_000);
        return withDeadline(s.runCommand(g.cmd, g.args, { timeoutMs: opts.timeoutMs + 20_000, retry: false, stdin: opts.stdin, signal }), opts.timeoutMs + 15_000);
      };
      try {
        const r = await whenPausedResume(s, exec);
        if (!r) {
          const stderr = `Command did not finish within ${opts.timeoutMs} ms. If it started a server or another long-lived process, start it with background: true instead.`;
          return { stdout: "", stderr, exitCode: 124, execMs: Date.now() - t0, timedOut: true };
        }
        const res = r.result;
        const stderr = res.error ? `${res.stderr}${res.stderr ? "\n" : ""}${res.error}` : res.stderr;
        const exitCode = res.error && res.exit_code === 0 ? 127 : res.exit_code;
        return { stdout: res.stdout, stderr, exitCode, execMs: r.exec_ms, timedOut: exitCode === 124 };
      } catch (e) {
        const err = toSandboxError(e);
        if (err.code !== "timeout") throw err;
        return { stdout: "", stderr: `Command timed out after ${opts.timeoutMs} ms.`, exitCode: 124, execMs: Date.now() - t0, timedOut: true };
      }
    },

    spawn: async (id, cmd, args, opts) => {
      const s = await handle(id);
      return mapped(async () => {
        const p = await s.processes.create({ cmd: "bash", args: ["-lc", 'log="$1"; shift; exec "$@" >>"$log" 2>&1 </dev/null', "bash", opts.logPath, cmd, ...args], cwd: opts.cwd });
        return { processId: p.process_id };
      });
    },

    upload: async (id, path, data) => {
      const s = await handle(id);
      await mapped(() => s.files.upload(path, typeof data === "string" ? data : new Blob([new Uint8Array(data)])));
    },

    download: async (id, path) => {
      const s = await handle(id);
      return new Uint8Array(await mapped(() => s.files.download(path)));
    },

    preview: async (id, port, opts) => {
      const s = await handle(id);
      return mapped(() =>
        whenPausedResume(s, async () => {
          if (!s.data.ingress_enabled) await s.setIngress(true);
          await s.waitForPortReady(port, { timeoutMs: opts?.waitMs ?? 30_000 });
          return s.previewUrl(port);
        }),
      );
    },

    pause: async (id) => {
      const s = await handle(id);
      await mapped(async () => {
        await s.refresh();
        if (s.status === "paused") return;
        if (s.status !== "pausing") await s.pause();
        await s.waitUntilPaused({ timeoutMs: WAIT_MS });
      });
    },

    resume: async (id) => {
      const s = await handle(id);
      await mapped(async () => {
        await s.refresh();
        if (s.status === "running") return;
        if (s.status === "pausing") await s.waitUntilPaused({ timeoutMs: WAIT_MS });
        if (s.status !== "resuming") await s.resume();
        await s.waitUntilRunning({ timeoutMs: WAIT_MS });
      });
    },

    fork: async (id, spec = {}) => {
      const s = await handle(id);
      return mapped(async () => {
        const f = await s.fork({ start_paused: spec.startPaused, ingress_enabled: spec.ingress ?? s.data.ingress_enabled, egress: spec.egress && [...spec.egress] });
        handles.set(f.id, f);
        if (spec.startPaused) await f.waitUntilPaused({ timeoutMs: WAIT_MS });
        else await f.waitUntilRunning({ timeoutMs: WAIT_MS });
        return info(f);
      });
    },

    destroy: async (id) => {
      try {
        const s = await handle(id);
        await mapped(() => s.destroy());
      } catch (e) {
        if (toSandboxError(e).code !== "not_found") throw toSandboxError(e);
      } finally {
        handles.delete(id);
      }
    },

    list: () =>
      mapped(async () => {
        const all = await client.listSandboxes();
        return all.filter((s) => s.status !== "destroyed").map(info);
      }),
  };
}
