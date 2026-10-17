# Parallel work contracts (CreateOS × Stripe hackathon, 2026-10-17)

Every agent working in this repo follows this file. If a contract here is impossible, stop and say so in your report;
do not invent a different shape.

## Goal

Solvers is a marketplace of AI specialists ("Solvers") used inside Claude/ChatGPT through our MCP server. This repo
starts from the private `solvers-tempo` codebase (imported in the first commit, read-only reference at
`C:\Users\Raphael\Documents\Projetos\solvers-tempo`, never edit it) and becomes:

- **Zero crypto.** No blockchain, wallet, token, USDC, stablecoin, Tempo, Solana, Pix, escrow, guarantee, on-chain,
  NFT, ERC-721, SIWE, Privy, relay, indexer, faucet, staking, royalty, supply cap — in code, comments, UI text,
  i18n messages, tests or docs. Delete features and tests that only existed for these.
- **Identity = `users.id` (uuid)**, login by email magic link (`DEV_LOGIN=1` prints the link to the log instead of
  sending email).
- **Payments = Stripe Checkout** (test mode) + webhook, money in integer **USD cents**.
- **Code execution = CreateOS Sandbox** (`@nodeops-createos/sandbox`), the core new feature: the CreateOS Builder
  Solver writes code, runs it in a sandbox, and step gates are proven by real execution (`steps[].verify`).

Background: `PLANO.md` (Portuguese) §2, §4, §6, §7 and the "Atualização 17/10" section.

## Database (owner: server-identity; everyone else codes against this)

- New baseline migration (old migrations deleted). Drizzle property names in camelCase.
- `users(id uuid pk default gen_random_uuid(), email citext unique not null, email_verified_at timestamptz,
  created_at timestamptz default now())`
- `login_tokens(id uuid pk, user_id uuid fk users, token_hash text unique, expires_at, used_at)`
- Every wallet column becomes a uuid FK to `users(id)`:
  `creators.user_id`, `creator_invites.user_id`, `package_submissions.creator_user_id`,
  `package_reviews.reviewer_user_id`, `licenses.user_id`, `trials.user_id`, `reviews.author_user_id`,
  `review_drafts.author_user_id`, `user_profiles.user_id` (PK), `user_reputation.user_id`, `usage_events.user_id`,
  `sessions.user_id`, `oauth_codes.user_id`, `oauth_tokens.user_id`, `memory_keys.user_id`, `memories.user_id`,
  `escalations.user_id`, `payment_ledger.buyer_user_id`, `payment_ledger.payer_user_id`.
- Removed tables: `processed_events`, `indexer_failures`, `chain_txs`, `sent_txs`, `relay_log`, `usage_batches`,
  `payouts_deferred`, `escrows`, `milestones`, `auth_nonces`, `wallet_persons`, `credits`, `kv`.
- Removed columns: everything chain-related (`tx_hash`, `token_id`, `onchain`, `chain_index`, `sync_flag`,
  `price_per_use`, `log_index`, `token_address`, `purchase_id`, `ref`, royalty/supply/guarantee fields).
- `licenses.id` is `uuid`; `licenses.stripe_checkout_session_id text unique`.
- `agents.price_cents integer not null`.
- `payment_ledger`: `amount_cents bigint`, `currency text default 'usd'`, `provider_ref text unique`
  (Checkout Session id), `status` keeps the existing lifecycle values.
- `stripe_events(id text pk, type text, received_at timestamptz default now(), processed_at timestamptz)`.
- `sandboxes(id uuid pk, user_id, session_id text, createos_id text, status text, created_at, last_used_at,
  runs int default 0)`.
- `sandbox_runs(id uuid pk, sandbox_id uuid, user_id, agent_id text, command text, exit_code int, exec_ms int,
  stdout_bytes int, kind text /* run | verify | preview */, created_at)`.

## Server module seams

- `req.userId: string` (uuid) replaces `req.wallet` everywhere.
- `apps/server/src/auth/middleware.ts` (server-identity) exports `requireUser` (cookie `solvers_session` or MCP
  bearer → `req.userId`, 401 otherwise) and `optionalUser`.
- `apps/server/src/payments/stripe-routes.ts` (stripe) exports `stripeWebhookHandler: RequestHandler` (expects a raw
  `Buffer` body) and `checkoutRouter: Router` (mounted at `/api`, has `POST /checkout`). server-identity mounts
  `app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler)` **before**
  `express.json()`, and `app.use("/api", checkoutRouter)`.
- `apps/server/src/sandbox/verify.ts` (sandbox) exports
  `runStepVerify(input: { userId: string; sessionId: string; agentId: string; checks: VerifyCheck[] }):
  Promise<{ passed: boolean; results: VerifyResult[] }>` with
  `VerifyCheck = { label: string; command: string; args?: string[]; expectExit?: number /* default 0 */ }` and
  `VerifyResult = { label: string; passed: boolean; exitCode: number; stdout: string; stderr: string; execMs: number }`.
  server-domain calls it from `runtime/engine.ts` before advancing a step that has `verify`; a failed check blocks
  the advance and returns stdout/stderr to the model; passed checks are shown as proof.
- `apps/server/src/mcp/sandbox-tools.ts` (sandbox) exports the definitions/handlers of the MCP tools
  `sandbox_run`, `sandbox_preview`, `sandbox_checkpoint`, `sandbox_restore` in the same shape `mcp/tools.ts` uses;
  server-domain registers them with a single import in `mcp/tools.ts`.
- `apps/server/src/sandbox/jobs.ts` (sandbox) exports `destroyIdleSandboxes(): Promise<number>`; server-identity
  schedules it in `jobs.ts`.

## Manifest (owner: server-domain in `runtime/manifest.ts`; shared types in `packages/shared`)

- `pricing.priceCents` (integer, min 500) replaces `priceUsdc`; no `royaltyBps`, `supply`, `guarantee`.
- `steps[].verify?: VerifyCheck[]` (shape above). `gate` stays as the human-readable checklist; each `verify.label`
  should match a `gate` line.

## Env (owner: server-identity in `env.ts` + `apps/server/.env.example`)

`PORT=3038`, `PUBLIC_API_URL`, `PUBLIC_WEB_URL` (web dev 3041), `DATABASE_URL`, `JWT_SECRET`, `MEMORY_KEK`,
`ADMIN_USER_IDS`, `DEV_LOGIN`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
`CREATEOS_SANDBOX_API_KEY`, `CREATEOS_SANDBOX_BASE_URL` (default `https://api-eu.sb.createos.sh`),
`SANDBOX_MODE=createos|simulated`, `VERIFIER_MODE=createos|simulated`, `SANDBOX_SHAPE=s-1vcpu-1gb`.
Real values live in the repo-root `.env` (owned by Stripe Projects; never print or commit values).

## Rules for every agent

1. Edit only the paths you own. Anything you need elsewhere goes in your report under **Needs from others**.
2. Do not run `pnpm install`/`pnpm add`, `git commit`, or anything that writes `.env*` or `.projects/`. If you need a
   dependency, name it in the report.
3. CreateOS free plan: 1 concurrent sandbox, 10 creations per day. Only the **sandbox** agent may create real
   sandboxes (at most 3, always destroyed in `finally`). Everyone else uses the fake/simulated mode.
4. No DB-backed tests against Neon. Unit tests only (`*.db.test.ts` may stay broken; note them).
5. Match the surrounding code: naming, comment density, idioms. English for code, comments and UI default locale.
6. Finish within ~60 minutes. End with a report: files changed, what works (with the command you ran), remaining
   type errors in your area (should be zero), errors you saw in other areas, Needs from others.
