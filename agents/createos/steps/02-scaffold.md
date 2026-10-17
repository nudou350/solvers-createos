# Step 2: Scaffold in the sandbox

## Goal

Create the project in `/workspace/app` inside the session sandbox and install its dependencies, so that every later step builds on code that already installs cleanly. The gate is proven by real execution: `npm install` must exit 0 in the sandbox.

## What to ask the user

Nothing, unless the spec left the runtime open. Tell the user in one line what you are creating and that it runs in an isolated CreateOS sandbox, not on their machine.

## How to run

1. **Start from the template.** Get `express-stripe-skeleton` with `get_template`. Adapt names to the spec (order -> reservation, link, signup...), but keep the structure: `src/app.js` builds the app without listening, `src/server.js` listens on `0.0.0.0:3000`, `src/store.js` holds data, tests in `test/*.test.js`.
2. **`package.json` must have** `"type": "module"`, scripts `"start": "node src/server.js"`, `"test": "node --test test/*.test.js"`, `"test:webhook": "node --test test/webhook.test.js"`, and only the dependencies you use (`express`, `stripe`; add others only with a reason). Pin major versions with `^`.
3. **Write all files in one call.** Use `sandbox_run` with `files` containing every file (full paths under `/workspace/app/`), and the command `bash` with args `["-lc", "cd /workspace/app && npm install --no-audit --no-fund"]`. One call writes and installs; do not spend a run on `mkdir` (upload creates what is needed; if it reports a missing directory, add `mkdir -p /workspace/app/src /workspace/app/test &&` at the start of the same command).
4. **Read the result.** `exit_code` 0 means installed. Otherwise read `stderr`:
   - `E404` / `No matching version`: wrong package name or version; fix `package.json` and re-run.
   - `ETIMEDOUT`, `ENOTFOUND`, `EAI_AGAIN` for a host other than `registry.npmjs.org`: the egress allowlist blocks it (a dependency downloads a binary). Replace the dependency; do not retry.
   - `ERESOLVE`: peer conflict; align versions rather than using `--force`.
5. **Show proof.** Quote the last lines of the install output (`added N packages`) and `exec_ms`. When you call `next_step`, the server re-runs `npm install --no-audit --no-fund` in `/workspace/app` and only advances if it exits 0.
6. **Keep a copy of every file you wrote** in your context: you will deliver the full project at the end. If the session is long, re-read files from the sandbox with `sandbox_run` (`cat`) instead of retyping from memory.

## Common mistakes

- Writing files one per call: wastes runs (the trial has few). Batch them.
- Forgetting `"type": "module"` with `import` syntax, or mixing `require` and `import`.
- Listening on `localhost` or `127.0.0.1`: the preview cannot reach it. Bind `0.0.0.0`.
- Adding a framework that needs a heavy build (Next.js, webpack) on a 1 GB sandbox for a simple API.
- Retrying a blocked download in a loop instead of reading the error.
- Telling the user it installed without quoting the real output.

## result_summary format

```
project: /workspace/app
files: <list of paths>
dependencies: <name@range, ...>
install: exit <code>, <exec_ms> ms, "<last line of output>"
scripts: start=<...>; test=<...>; test:webhook=<...>
```
