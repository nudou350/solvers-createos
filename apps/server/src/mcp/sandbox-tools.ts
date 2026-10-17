import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { badRequest, HttpError } from "../lib/http.js";
import type { ServerToolCtx } from "../runtime/tools.js";
import { toSandboxError } from "../sandbox/client.js";
import { sandboxPool } from "../sandbox/deps.js";
import { sandboxHttpError, type Pool } from "../sandbox/pool.js";
import { checkCommand, checkPort, checkUploads, clampTimeout, MAX_TIMEOUT_MS, runView, WORKSPACE } from "../sandbox/rules.js";
import type { McpContext, SessionToolRunner } from "./tools.js";

// MCP tools that run code in the session's CreateOS sandbox. The MCP handlers go through `runSessionTool` (session
// access + the free-trial gate of mcp/tools.ts, the same one run_tool uses), which ends in runServerTool → runSandboxTool
// for tools with runner `builtin:sandbox`. runSandboxTool never counts trial runs; `ctx.trial` only lowers limits.

const files = z
  .array(z.object({ path: z.string().min(1).max(300), content: z.string() }))
  .max(50)
  .describe(`Files written before the command runs: [{ path, content }], paths relative to ${WORKSPACE} or absolute inside it`);

const RunInput = z.object({
  command: z.string().min(1).max(4096),
  args: z.array(z.string()).max(100).optional(),
  files: files.optional(),
  timeout_ms: z.number().int().min(1000).max(MAX_TIMEOUT_MS).optional(),
  background: z.boolean().optional(),
});
const PreviewInput = z.object({ port: z.number().int().min(1).max(65535) });
const CheckpointInput = z.object({});
const RestoreInput = z.object({ checkpoint_id: z.string().min(1).max(100) });

export const SANDBOX_TOOL_NAMES = ["sandbox_run", "sandbox_preview", "sandbox_checkpoint", "sandbox_restore"] as const;

/** Pure input checks (rules.ts) as 400s: the trial gate gives the run back when the input is refused. */
function rule<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw badRequest((e as Error).message);
  }
}

async function handle(pool: Pool, name: string, input: unknown, ctx: ServerToolCtx): Promise<unknown> {
  const meta = { userId: ctx.userId, agentId: ctx.agentId, kind: "run" as const };
  switch (name) {
    case "sandbox_run": {
      const i = RunInput.parse(input);
      const args = i.args ?? [];
      rule(() => checkCommand(i.command, args));
      const uploads = rule(() => checkUploads(i.files ?? []));
      const timeoutMs = clampTimeout(i.timeout_ms, ctx.trial != null);
      const lease = await pool.session(ctx.userId, ctx.sessionId);
      await pool.upload(lease, uploads);
      if (i.background) {
        const p = await pool.spawn(lease, i.command, args, meta);
        return {
          process_id: p.processId,
          log_path: p.logPath,
          note: `Started in the background from ${WORKSPACE}. Read its output with sandbox_run (e.g. tail -n 50 ${p.logPath}); for a server, listen on 0.0.0.0 and call sandbox_preview with its port.`,
        };
      }
      const out = await pool.run(lease, i.command, args, { timeoutMs, cwd: WORKSPACE }, meta);
      return { ...runView(out), ...(out.timedOut ? { timed_out: true, timeout_ms: timeoutMs } : {}) };
    }
    case "sandbox_preview": {
      const { port } = PreviewInput.parse(input);
      rule(() => checkPort(port));
      const lease = await pool.session(ctx.userId, ctx.sessionId);
      try {
        const url = await pool.preview(lease, port, meta);
        return { url, port, note: "Public URL of the sandbox port. It works while the sandbox runs (it pauses after 5 idle minutes and is deleted after 30)." };
      } catch (e) {
        if (!(e instanceof HttpError) && toSandboxError(e).code === "timeout") {
          throw new HttpError(409, `Nothing answered on port ${port} in 30 s. Start the server with sandbox_run (background: true), make it listen on 0.0.0.0:${port}, then try again.`);
        }
        throw e;
      }
    }
    case "sandbox_checkpoint": {
      CheckpointInput.parse(input);
      const r = await pool.checkpoint(ctx.userId, ctx.sessionId);
      const how = r.method === "fork" ? "a paused fork of the whole sandbox (files, dependencies and memory)" : `a snapshot of ${WORKSPACE}`;
      return { checkpoint_id: r.checkpointId, method: r.method, note: `Saved as ${how}. To go back: sandbox_restore with this checkpoint_id.` };
    }
    case "sandbox_restore": {
      const { checkpoint_id } = RestoreInput.parse(input);
      const r = await pool.restore(ctx.userId, ctx.sessionId, checkpoint_id);
      const note =
        r.method === "fork"
          ? `The sandbox is back at the checkpoint (a new copy of it; background processes from the checkpoint resume as they were).${r.reusable ? " The checkpoint can be restored again." : " This checkpoint was used up: take a new one before the next risky change."}`
          : `${WORKSPACE} is back at the checkpoint. Background processes kept running: restart servers that read the old files.`;
      return { restored: true, checkpoint_id, method: r.method, note };
    }
    default:
      throw badRequest(`Unknown sandbox tool: ${name}`);
  }
}

/** Runner of `builtin:sandbox` tools (called by runServerTool after the trial gate). */
export async function runSandboxTool(name: string, input: unknown, ctx: ServerToolCtx): Promise<unknown> {
  const body = { ...(input as Record<string, unknown>) };
  delete body.session_id;
  try {
    return await handle(await sandboxPool(), name, body, ctx);
  } catch (e) {
    throw sandboxHttpError(e) ?? e;
  }
}

/** Testable core: the same handlers on an injected pool. */
export function runSandboxToolWith(pool: Pool, name: string, input: unknown, ctx: ServerToolCtx): Promise<unknown> {
  return handle(pool, name, input, ctx);
}

function text(t: string, isError = false) {
  return { content: [{ type: "text" as const, text: t }], ...(isError ? { isError: true } : {}) };
}

/** Friendly errors, never a stack (same contract as the `tool` wrapper of mcp/tools.ts). */
function wrap<A extends { session_id: string }>(name: string, runSessionTool: SessionToolRunner) {
  return async (args: A) => {
    const { session_id, ...input } = args;
    try {
      return text((await runSessionTool(session_id, name, input)).text);
    } catch (e) {
      if (e instanceof HttpError) return text(e.message, true);
      if (e instanceof z.ZodError) return text(`Invalid input for ${name}: ${e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, true);
      console.error(`[mcp] ${name}`, e);
      return text("I couldn't finish that right now. Please try again in a moment.", true);
    }
  };
}

export function registerSandboxTools(server: McpServer, _ctx: McpContext, runSessionTool: SessionToolRunner): void {
  const session_id = z.string().describe("session_id from activate_solver");

  server.registerTool(
    "sandbox_run",
    {
      title: "Run code in the sandbox",
      description: `Runs a command in this session's isolated CreateOS sandbox (Linux, Node 24, Python 3.13; working directory ${WORKSPACE}), optionally writing files first. Returns stdout, stderr, exit_code, exec_ms and truncated (each stream is cut to 16 KB). Use bash -lc for cd, && and pipes. background: true starts a long-lived process (e.g. an app server) and returns at once with its log file. User code runs only here, never on the user's machine. Network access is limited to package registries and GitHub.`,
      inputSchema: {
        session_id,
        command: z.string().min(1).max(4096).describe("Executable, e.g. node, npm, python3, bash"),
        args: z.array(z.string()).max(100).optional().describe('Arguments, e.g. ["-lc", "npm test"]'),
        files: files.optional(),
        timeout_ms: z.number().int().min(1000).max(MAX_TIMEOUT_MS).optional().describe("Default 60000, max 300000 (120000 in the free trial)"),
        background: z.boolean().optional().describe("Start and return immediately (servers, watchers)"),
      },
    },
    wrap("sandbox_run", runSessionTool),
  );

  server.registerTool(
    "sandbox_preview",
    {
      title: "Live preview URL",
      description: "Returns a public URL for a port of this session's sandbox, after waiting until the port answers. The server must already be running (sandbox_run with background: true) and listen on 0.0.0.0.",
      inputSchema: { session_id, port: z.number().int().min(1).max(65535) },
      annotations: { readOnlyHint: true },
    },
    wrap("sandbox_preview", runSessionTool),
  );

  server.registerTool(
    "sandbox_checkpoint",
    {
      title: "Checkpoint the sandbox",
      description: "Saves the current state of this session's sandbox before a risky change and returns a checkpoint_id for sandbox_restore.",
      inputSchema: { session_id },
    },
    wrap("sandbox_checkpoint", runSessionTool),
  );

  server.registerTool(
    "sandbox_restore",
    {
      title: "Restore a checkpoint",
      description: "Brings this session's sandbox back to a checkpoint taken with sandbox_checkpoint, discarding the changes made after it. Use it when a fix made things worse.",
      inputSchema: { session_id, checkpoint_id: z.string().min(1).max(100) },
      annotations: { destructiveHint: true },
    },
    wrap("sandbox_restore", runSessionTool),
  );
}
