# Step 1: Spec and stack

## Goal

Turn the user's one-line idea into a small, testable spec, pick the runtime, list every external service with the exact command that provisions it, and prove the session sandbox is up. Nothing is built in this step; a wrong spec here costs every later step.

## What to ask the user

Ask at most three questions, in one message, and only what changes the build. Offer a default for each so the user can just say "go":

- Who pays, for what, and how much? (Default: one-off payment, price in US$ the user names, stored as integer cents.)
- What must the first version do? Propose 3 to 5 behaviors you inferred and ask them to cut or add.
- Any constraint on stack or data? (Default: Node 24 + Express 5, in-memory store for the demo, Postgres later.)

Never ask for API keys, passwords or card numbers. Keys are set by the user on CreateOS at deploy time (step 5), never pasted in the chat.

## How to run

1. **Read the idea back** in one paragraph and fill the `app-spec` template (`get_template`). Keep the scope to what fits one session: 2 to 5 endpoints, one payment flow, one data model. Move everything else to `not_now`.
2. **Pick the runtime.** Default to Node 24 + Express 5 + `node:test` (it matches the `express-stripe-skeleton` template and the step gates). Pick Python 3.12 + FastAPI only if the user asks or the idea is data-heavy; then you must still provide `package.json` scripts `test`, `test:webhook` and `start` that call Python, because the gates run `npm test`. The app listens on **port 3000** in the sandbox.
3. **List the services.** For each external service (hosting, database, auth, email), write one row: why the app needs it, the `stripe projects add <provider>/<service>` command, and the env vars it produces. Use `search_knowledge` ("stripe projects", "createos deploy") and copy only slugs you can justify; otherwise tell the user to confirm with `stripe projects catalog <provider>`. Never invent a slug. These commands are for the user's own terminal, not for the sandbox.
4. **Confirm with the user.** Show the spec and the services table, and wait for an explicit yes (or edits) before step 2.
5. **Prove the sandbox is up.** Call `sandbox_run` with `command: "node", args: ["-v"]`. This creates the session sandbox (`devbox:1`: Ubuntu 24.04, Node 24, Python 3.12, Bun, Go, Rust) on the first call. Report the version you got. When you call `next_step`, the server runs the gate checks itself (`node -v` and `python3 --version`, both must exit 0) and shows the proof; if a check fails, read its stderr and say what happened, do not claim the step passed.

### How the sandbox works (read once, applies to every step)

- **All code runs in the sandbox, never on the user's machine.** The user never needs to run the app, `npm install` or tests locally to "check": you run them in the sandbox and show the output. The only commands the user runs are provisioning and deploy commands (Stripe Projects, CreateOS CLI, git).
- `sandbox_run` takes `command`, `args`, optional `files: [{ path, content }]` (uploaded before the command; paths under `/workspace`) and optional `timeout_ms` (max 300000). It returns `stdout`, `stderr`, `exit_code`, `exec_ms` and `truncated`. The command is not a shell: for `cd`, `&&`, pipes or globs use `command: "bash", args: ["-lc", "cd /workspace/app && ..."]`.
- The project lives in `/workspace/app`. One sandbox per session; it auto-pauses after 5 idle minutes and resumes with files and `node_modules` intact.
- **Egress is an allowlist**: `registry.npmjs.org`, `pypi.org`, `*.pythonhosted.org`, `github.com`, `*.githubusercontent.com`, all on 443. Everything else (including `api.stripe.com`) is blocked, so tests must never call external APIs.
- Output is trimmed to about 16 KB per stream; when `truncated` is true, re-run with a narrower command (`| tail -n 60`, a single test file).
- During the free trial the number of runs is limited (the `activate_solver` answer tells you how many): batch files into one call and do not run commands just to look around.

## Common mistakes

- Starting to code before the user confirmed the spec.
- A spec with "user accounts, admin panel, emails and analytics": cut to the paid core and list the rest in `not_now`.
- Guessing `stripe projects add` slugs, or telling the user to run them inside the sandbox.
- Prices as floats ("9.99"): store integer cents (`999`).
- Asking the user to paste `sk_test_...` or `whsec_...` into the chat.
- Telling the user "run `npm install` on your machine to try it": everything runs in the sandbox.

## result_summary format

```
idea: <one line>
spec_confirmed: yes|no (what changed)
runtime: <node 24 + express 5 | python 3.12 + fastapi>; port: 3000
endpoints: <METHOD /path, ...>
payment: <what, amount in cents, one-off|recurring|none>
services: <service -> stripe projects add command | dashboard>, ...
sandbox: node <version>, python <version>
not_now: <items>
```
