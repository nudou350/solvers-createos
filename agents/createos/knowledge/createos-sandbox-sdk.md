---
title: CreateOS Sandbox TypeScript SDK: create, run, files, processes, preview, pause, resume, fork, egress
source: CreateOS Sandbox SDK (@nodeops-createos/sandbox 0.8.2 README and type definitions) and CreateOS Sandbox docs
source_url: https://github.com/NodeOps-app/createos-sandbox-sdk
source_date: 2026-10-17
valid_until: 2027-01-15
trial: true
tags: [createos, sandbox, sdk, typescript, exec, files, preview, fork, pause]
---

## What the SDK is

`@nodeops-createos/sandbox` (version 0.8.2 checked on 2026-10-17) is the TypeScript client for CreateOS Sandbox: Firecracker microVMs, one kernel per sandbox, with an in-kernel egress allowlist and pause, resume and fork of the full VM state. It is ESM-only, has zero runtime dependencies and needs Node 20+ (or Bun, Deno, edge runtimes with global `fetch`). Install: `npm install @nodeops-createos/sandbox`.

In Solvers you do **not** call this SDK yourself. The Solvers server holds the CreateOS key and exposes it to you through the MCP tools `sandbox_run`, `sandbox_preview`, `sandbox_checkpoint` and `sandbox_restore`. This file explains what happens underneath, so you can read errors and choose the right tool. Use it directly only when the user's own app needs to create sandboxes (for example an "AI code runner" product).

## Create a sandbox

```ts
import { CreateosSandboxClient } from "@nodeops-createos/sandbox";

// apiKey from CREATEOS_SANDBOX_API_KEY, baseUrl from CREATEOS_SANDBOX_BASE_URL
const client = new CreateosSandboxClient();
const sandbox = await client.createSandbox({
  shape: "s-1vcpu-1gb",
  rootfs: "devbox:1",
  egress: ["registry.npmjs.org:443"],
  auto_pause_after_seconds: 300,
});
try {
  // ... work
} finally {
  await sandbox.destroy(); // sandboxes bill while running
}
```

`createSandbox` blocks until the sandbox is `running`. Request fields (`CreateSandboxRequest`): `shape` (required), `rootfs`, `name`, `egress`, `envs`, `ingress_enabled`, `disk_mib`, `region`, `auto_pause_after_seconds`, `ssh_pubkeys`, `networks`, `disks`. Status values: `creating`, `running`, `pausing`, `paused`, `resuming`, `forking`, `error`, `destroying`, `destroyed`, `failed`. Reconnect to an existing one with `Sandbox.connect(id)`.

## Run commands

```ts
const { result, exec_ms } = await sandbox.runCommand("bash", ["-lc", "cd /workspace/app && npm test"], { timeoutMs: 300_000 });
// result: { stdout, stderr, exit_code, error? }
await sandbox.sh("mkdir -p /workspace/app"); // shell script shortcut
for await (const ev of sandbox.streamCommand("npm", ["run", "build"])) { /* NDJSON events */ }
```

- `runCommand(cmd, args, { timeoutMs, env, stdin })` returns `{ result: { stdout, stderr, exit_code, error? }, exec_ms }`.
- Buffered output is capped at **1 MiB**; use `streamCommand` for more. The Solvers tool trims further (about 16 KB per stream) and says so with `truncated`.
- The command is not a shell unless you call a shell: pipes, `cd`, `&&` and globbing need `bash -lc "..."`.

## Files

`sandbox.files.upload(path, data)` writes a file; `sandbox.files.download(path)` returns an `ArrayBuffer`. Create the parent directory first (`mkdir -p`). In Solvers, `sandbox_run` accepts `files: [{ path, content }]` and uploads them before the command; paths must be under `/workspace`.

## Long-running processes (servers)

`sandbox.processes.create({ cmd, args, cwd, env })` starts a managed process that keeps running after the call returns; `list`, `get`, `wait`, `signal`, `delete` manage it, and `connect` streams its output. Retained output is bounded to 1 MiB per process and 32 MiB per sandbox. Through `sandbox_run`, start a server detached (see step 5): `bash -lc "cd /workspace/app && nohup npm start > /tmp/app.log 2>&1 &"`.

## Preview (ingress)

```ts
await sandbox.setIngress(true);
await sandbox.waitForPortReady(3000);
const url = sandbox.previewUrl(3000); // https by default; { scheme: "http" } is also accepted
```

Only a server bound to `0.0.0.0` is reachable; one bound to `127.0.0.1` is not. In Solvers this is `sandbox_preview { session_id, port }`.

## Pause, resume, fork

- `pause()`: a Firecracker snapshot to durable storage; compute billing stops, disk and memory state are kept. `resume()` brings processes back intact.
- `auto_pause_after_seconds` (60 to 86,400) pauses after that long without exec, file transfer or tunnel activity. Off by default.
- `fork({ egress?, ingress_enabled?, envs?, start_paused? })` returns a **new** `Sandbox` with a copy of the full state. Solvers uses it for `sandbox_checkpoint`: try a risky fix on one copy, keep the other to go back to.

## Egress at runtime

`getEgress()` and `setEgress(rules | null)` read and replace the allowlist live, with no restart. `[]`, `null` or `["*"]` means allow all. See the networking file for the rule format.

## Errors

Errors are a typed hierarchy under `CreateosSandboxError`: `...AuthError` (401), `...PermissionError` (403), `...NotFoundError` (404), `...PaymentRequiredError` (402), `...ValidationError` (422), `...RateLimitError` (429, for example over the plan's concurrent cap), `...ServerError`, `...ConnectionError`, `...TimeoutError`. Idempotent requests retry transient failures with backoff and honor `Retry-After`.
