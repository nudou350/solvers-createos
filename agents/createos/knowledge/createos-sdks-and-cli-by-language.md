---
title: CreateOS SDKs and CLI by language (TypeScript, Go, Rust, C#, Java, CLI, agent plugins)
source: NodeOps-app GitHub repositories (createos-sandbox-sdk, createos-cli, createos-plugins, createos-go-sdk, createos-rust-sdk, createos-csharp-sdk, createos-java-sdk) and CreateOS Sandbox docs overview
source_url: https://createos.sh/docs/Sandbox/Overview
source_date: 2026-10-17
valid_until: 2027-01-15
tags: [createos, sdk, cli, go, rust, csharp, java, typescript, plugins]
---

Use this when the user's own app must create or drive sandboxes (an AI code runner, a grader, a preview service) and they write it in a language other than TypeScript. Copy the package name exactly; the method names below come from each README.

## TypeScript / JavaScript

- Package: `@nodeops-createos/sandbox` (`npm install @nodeops-createos/sandbox` or `bun add ...`). ESM-only, Node 20+.
- Repo: https://github.com/NodeOps-app/createos-sandbox-sdk
- `new CreateosSandboxClient()` (reads `CREATEOS_SANDBOX_API_KEY` and `CREATEOS_SANDBOX_BASE_URL`), `client.createSandbox({ shape, rootfs, egress })`, `sandbox.runCommand(cmd, args, { timeoutMs })`, `sandbox.files.upload/download`, `sandbox.processes.create`, `waitForPortReady`, `previewUrl`, `pause`, `resume`, `fork`, `destroy`.

## Go

- Module: `github.com/NodeOps-app/createos-go-sdk` (packages `sandbox`, `structs`); `go get github.com/NodeOps-app/createos-go-sdk`.
- `sandbox.NewClient(sandbox.WithAPIKey(key))`, `client.CreateSandbox(ctx, structs.CreateSandboxRequest{Shape: "s-1vcpu-1gb", RootFS: "devbox:1"})`, `instance.RunCommand(ctx, structs.RunCommandRequest{Command: "sh", Arguments: []string{"-c", "..."}}, structs.ExecOptions{})` then `response.Result.StandardOutput`; also `StreamCommand`, `Files().Upload/Download`, `Processes().Create/Wait`, `WaitForPort`, `PreviewURL`, `Pause`, `Fork`, `Resume`, `Destroy`.

## Rust

- Crate: `createos` (`cargo add createos` plus `cargo add tokio --features macros,rt-multi-thread`).
- `Client::builder().api_key(key).build()?`, `client.create_sandbox(CreateSandboxRequest { shape, rootfs: Some("devbox:1".into()), .. })`, `sandbox.run_command(RunCommandRequest { command, arguments, .. }, Default::default())`, `response.result.standard_output`; also `stream_command`, `files().upload/download`, `processes().create/wait`, `wait_for_port`, `preview_url`, `pause`, `fork`, `resume`, `destroy`.

## C# / .NET

- NuGet: `CreateOS.Sandbox` (`dotnet add package CreateOS.Sandbox`), targets .NET 8.
- `new SandboxClient(new SandboxClientOptions { ApiKey = key })`, `CreateSandboxAsync(new CreateSandboxRequest { Shape, RootFileSystem = "devbox:1" })`, `RunCommandAsync(...)`, `response.Result.StandardOutput`; also `Files.UploadAsync`, `Processes.CreateAsync`, `WaitForPortAsync`, `GetPreviewUri`, `PauseAsync`, `ForkAsync`, `ResumeAsync`, `SetAutoPauseAsync`, `DestroyAsync`.

## Java

- Maven: `groupId` `sh.createos`, `artifactId` `createos-java-sdk` (check Maven Central for the version); Java 17.
- `CreateOsClient.builder().apiKey(key).build()`, `client.createSandbox(CreateSandboxRequest.builder("s-1vcpu-1gb").rootFileSystem("devbox:1").build())`, `sandbox.runCommand(RunCommandRequest.of("sh", "-c", "..."))`, `response.result().standardOutput()`, `sandbox.destroy()` in `finally`; also `streamCommand`, `files()`, `processes()`, `waitForPort`, `previewUrl`, `pause`, `fork`, `resume`.

## CLI (`createos`)

- Repo: https://github.com/NodeOps-app/createos-cli. Install with the `install.sh` script or Homebrew on macOS/Linux; on Windows download the binary from the releases page.
- Sandbox commands: `createos sandbox create --shape s-1vcpu-1gb --name my-box`, `exec my-box -- uname -a`, `shell my-box`, `list`, `get`, `pause`, `resume`, `fork`, `rm my-box --force`, `process`, `push`/`pull`/`sync` (files), `tunnel`, `shapes`, `rootfs`; `create --ingress` gives a public HTTPS URL. Deploy commands are in the deploy file.

## Agent plugins

- Repo: https://github.com/NodeOps-app/createos-plugins. Hooks-based plugins (not MCP) for Claude Code, Codex, Pi, OpenCode and DeepSeek Harness that offload commands to a sandbox. Claude Code: `/plugin marketplace add NodeOps-app/createos-plugin` then `/plugin install createos-sandbox@createos`; example `/createos-sandbox:offload . "npm ci && npm test"`.
- Inside Claude.ai or ChatGPT with Solvers you do not need these: the Solvers MCP tools already run the sandbox for you.

## Rules for every language

Always destroy sandboxes in `finally` (they bill while running), set an egress allowlist for untrusted code, keep the API key on the server, and handle the 429 that a create returns over the plan's concurrent cap.
