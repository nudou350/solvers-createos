# Solvers × CreateOS: AI specialists that prove every step by running it

> Built for the **CreateOS × Stripe "Build Agents That Run Code"** hackathon (Oct 17, 2026).

Ask an AI to build something and you get code that *looks* right. Whether it installs, whether the tests pass, whether
the server even starts is left to you. **CreateOS Builder** is a specialist agent that closes that gap: it writes the
code, runs it in a **CreateOS Sandbox**, reads the real errors, fixes them, and is not allowed to move to the next step
of its method until the step's checklist is **proven by execution** (exit codes, test runs, a health check). It ends
with a **live preview URL** of the running app.

It is sold through **Solvers**, a marketplace of AI specialists, with **Stripe Checkout**, and used inside the AI the
customer already has (Claude, ChatGPT) through our MCP connector. The stack was provisioned with **Stripe Projects**.

**Live (on CreateOS):** web https://production-solvers-web.tyzo.nodeops.app · MCP connector `https://production-solvers-api.tyzo.nodeops.app/mcp` · demo video https://vimeo.com/1236904942

---

## What happens in a session

```
You (in Claude)  ──  "Build me a waitlist API that takes a paid reservation"
   │
   ▼  MCP (OAuth 2.1 + PKCE)
Solvers API ── activate_solver(createos) ── license? (bought with Stripe Checkout) ── yes
   │
   ├─ Step 1  Spec & stack ........ sandbox_run node -v / python3 --version      gate ✓ proven
   ├─ Step 2  Scaffold ............ npm install in /workspace/app                gate ✓ proven
   ├─ Step 3  Code & tests ........ npm test  ✗ exit 1  → the step does NOT advance
   │                                sandbox_checkpoint → fix → (bad fix? sandbox_restore) → npm test ✓
   ├─ Step 4  Stripe payments ..... webhook signature tests                      gate ✓ proven
   └─ Step 5  Preview & deploy .... npm start (background) → sandbox_preview      gate ✓ proven
                                    https://<sandbox>-3000.app.sb.createos.sh  (live URL)
```

Each step's gate is declared in the Solver package (`agents/createos/manifest.json`, `steps[].verify`). When the
model calls `next_step`, **the server itself** runs those checks in the session's sandbox; a failing check blocks the
step and hands stdout/stderr back to the model, a passing one is shown as proof (command, exit code, milliseconds).
The model cannot talk its way past a red test.

A real run, captured by `pnpm --filter @solvers/server cli:demo-mcp` (an MCP client that plays the model's part):

```
━━ Step 3 · Code and tests: the gate blocks, then passes
→ sandbox_run npm test   ✗ exit 1   │ ✖ GET /health answers 200 { ok: true }
→ next_step   ✗ Step 3 is not done yet: its gate checks failed in the sandbox, so the session did not advance.
→ sandbox_checkpoint   ✓ checkpoint 6426d6f1-…
  attempt 1 (a typo slips in)   ✗ SyntaxError: missing ) after argument list
→ sandbox_restore   ✓ restored
  attempt 2 (the real fix)      ✓ pass 1 · fail 0
→ next_step   Step 3 gate proven: Test suite passes (exit 0, 320 ms)
━━ Step 5 · Live preview
→ sandbox_run npm start [background]   ✓ started
→ sandbox_preview port=3000   ✓ https://01m55sq1b9jgpb6veyvm385se0-3000.app.sb.createos.sh   → 200 {"ok":true}
```

## How we used the sponsor tools

### CreateOS Sandbox (`apps/server/src/sandbox/`, `apps/server/src/mcp/sandbox-tools.ts`)

| Feature | How Solvers uses it |
|---|---|
| `devbox:1` sandboxes | One sandbox per (user, Solver session), created on first use (~0.4 s), reused across steps. |
| Run code | `sandbox_run` MCP tool: upload files, run a command, get stdout/stderr/exit code (truncated safely for the model), hard timeouts. |
| Background processes | `sandbox_run { background: true }` starts the app server and returns at once (process API). |
| **Egress control** | Sandboxes are created with an allowlist (npm, PyPI, GitHub); everything else is denied. The user's keys never enter the sandbox. |
| **Live URL** | Ingress on at creation; `sandbox_preview` waits for the port and returns the public HTTPS preview URL. |
| **Pause / resume** | `auto_pause_after_seconds: 300`; a paused sandbox is resumed transparently on the next call. |
| **Fork** | `sandbox_checkpoint` pauses and forks the sandbox before a risky fix; `sandbox_restore` forks the checkpoint back. On the free plan (1 concurrent sandbox) the fork is refused, and the checkpoint falls back to a `/workspace` snapshot. |
| Verified gates | `runStepVerify` (`sandbox/verify.ts`) runs a step's checks before the session may advance; every run is logged in `sandbox_runs`. |
| Verifier | Creator-submitted packages with test suites are verified in an ephemeral sandbox (`verifier/sandbox.ts`). |
| Hosting | API and web deployed on CreateOS (see Live above). |

### Stripe

- **Stripe Projects** provisioned the stack from the CLI: `stripe projects init`, `stripe projects add createos/free`,
  `createos/project` (the CreateOS account and project used for hosting), `neon/free` + `neon/postgres` (the database).
  Credentials land in `.env` via `stripe projects env --pull` (never committed; `.projects/state.json` is).
- **Stripe Checkout** (hosted, test mode) sells each Solver (`apps/server/src/payments/`). The plan came from Stripe's
  own integration planner (MCP `stripe_implementation_planner`): hosted Checkout + `checkout.session.completed`.
- **Webhook**: signature-verified, idempotent (`stripe_events` dedupe), and a paid session fulfils the ledger row and
  grants the license in **one transaction** (`licenses.stripe_checkout_session_id` is unique). Resending the same event
  never creates a second license. A reconciliation job re-checks sessions still pending after an hour.
- The ledger records the platform fee split (10%) in cents; payouts to creators with Stripe Connect are the next step.

## What was built during the hackathon vs. what existed

Being explicit, because the rules ask for new work:

- **Existed before (imported in the first commit, `d3cc272`):** the Solvers platform: catalog, Solver package format
  and runtime (method steps, gates, knowledge search, templates, memory, trials), MCP server and OAuth, creator
  submissions and review, the web storefront. It is the *distribution layer*.
- **Built today (every later commit):**
  - **CreateOS Builder** (`agents/createos/`): the new agent: method, gates with `verify`, knowledge base on CreateOS
    and Stripe, Express + Stripe template, evals.
  - **CreateOS Sandbox runtime**: session sandboxes, `sandbox_run` / `sandbox_preview` / `sandbox_checkpoint` /
    `sandbox_restore`, verify gates in the engine, the verifier on CreateOS, idle cleanup.
  - **Stripe**: Checkout, webhook, ledger in cents, Stripe Projects setup, deploy on CreateOS.
  - **Migration off the old stack**: the platform previously ran on a blockchain (wallet identity, on-chain licenses,
    stablecoin payments). All of it was removed: email identity (magic link), licenses in Postgres, Stripe payments.
    `pnpm check:crypto` enforces it.

## Run it locally

Requirements: Node 22+, pnpm 10, the Stripe CLI with the Projects plugin, a CreateOS account.

```bash
pnpm install
stripe projects init
stripe projects add createos/free && stripe projects add createos/project
stripe projects add neon/free && stripe projects add neon/postgres
stripe projects env --pull                       # writes .env (Neon, CreateOS)
# add to .env: STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY (test mode), CREATEOS_SANDBOX_API_KEY,
#              CREATEOS_SANDBOX_BASE_URL=https://api-eu.sb.createos.sh
# apps/server/.env: JWT_SECRET, MEMORY_KEK (32 bytes base64), DEV_LOGIN=1, SANDBOX_MODE=createos,
#                   STRIPE_WEBHOOK_SECRET (from `stripe listen --print-secret`)
pnpm --filter @solvers/server db:migrate
pnpm --filter @solvers/server cli:publish        # loads every Solver in agents/ into the catalog
pnpm --filter @solvers/server dev                # API on :3038
pnpm --filter @solvers/web dev                   # web on :3041
stripe listen --forward-to localhost:3038/api/stripe/webhook
```

Then sign in at `http://localhost:3041/login` (with `DEV_LOGIN=1` the link is shown on screen), buy CreateOS Builder
with the test card `4242 4242 4242 4242`, and add `http://localhost:3038/mcp` (or the public URL) as a connector in
Claude. Or run the scripted session: `pnpm --filter @solvers/server cli:demo-mcp -- --api http://localhost:3038`.

Checks: `pnpm -r typecheck`, `pnpm -r test`, `pnpm check:crypto`.

## Tech

TypeScript monorepo (pnpm + turbo) · **API** Express 5, MCP SDK (Streamable HTTP), OAuth 2.1 + PKCE, Drizzle ORM,
Postgres + pgvector on Neon, local multilingual embeddings · **Web** Next.js 16, React 19, next-intl (en/pt) ·
**Sandbox** `@nodeops-createos/sandbox` · **Payments** `stripe` (Checkout, webhooks) · Stripe Projects · CreateOS.

```
apps/server     API, MCP server, runtime, sandbox, payments
apps/web        storefront, login, checkout, library, connector consent
packages/shared types and rules shared by API and web
packages/api-client
agents/         Solver packages (createos = CreateOS Builder)
tools/          check:crypto gate
```

## Team

Raphael (`<discord handle>`).

## License

FSL-1.1-ALv2 (see `LICENSE`).
