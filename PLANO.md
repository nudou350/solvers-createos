# Solvers CreateOS: plano de implementação

Migração do Solvers (hoje em `solvers-tempo`, com blockchain Tempo) para uma versão **sem nada de cripto**, com
pagamentos pela **Stripe** e execução de código num **sandbox do CreateOS**, mais um Solver especialista em CreateOS. Alvo
imediato: o hackathon **CreateOS × Stripe "Build Agents That Run Code"** (sábado, 17/10/2026, 12h–19h PT = **16h–23h em
Brasília**; build de 12h30 a 18h PT, demos às 18h PT; prêmio de US$ 10k para os 3 primeiros; times de até 3; submissão no
leaderboard do Stripe Projects).

Escrito em 16/10/2026. Fonte do código: `C:\Users\Raphael\Documents\Projetos\solvers-tempo` (só leitura a partir deste
plano: copiamos de lá, nunca editamos lá). Os caminhos `server/...` e `web/...` abaixo são relativos a
`solvers-tempo/apps/`.

---

## ⚠️ Atualização 17/10 (prevalece sobre o resto do documento)

- **Prazo real:** submissões travam **17h30 PT (21h30 BRT)**, não 18h. Build para às **16h40 PT**; o resto é entrega.
- **Entrega obrigatória:** vídeo de 2–3 min **com alguém na câmera**; repo GitHub **público** com README (separando o
  que é pré-existente do que foi feito hoje); post no X/LinkedIn marcando @createosai / CreateOS; formulário;
  projects.dev/leaderboard com o código `CreateOS-2026`.
- **Elegibilidade:** pergunta enviada aos organizadores (Solvers como camada de distribuição, agente CreateOS como
  produto novo). **Até virar "sim" por escrito, a migração do Solvers é risco.**
- **Já pronto:** `.env` (gitignored) com chaves Stripe test e CreateOS; CreateOS `whoami` OK em
  `https://api-eu.sb.createos.sh`; plugin e MCP da Stripe conectados (conta "Solvers sandbox", test mode);
  planner da Stripe aceito: **Checkout hospedado + `checkout.session.completed`** (Connect fica para depois:
  marketplace, destination charges, Express, contas v2 `recipient`, onboarding embutido).
- **Falta instalar:** Stripe CLI (`npm i -g @stripe/cli@latest` + `stripe plugin install projects`) e CreateOS CLI
  (`createos-windows-amd64.exe` da release v0.0.31; o `install.sh` não suporta Windows).
- **Juízes pedem:** fork, egress, live URL, desktop, pause/resume. Somar **fork** ao loop de correção (forka antes de
  cada tentativa; descarta se falhar). Fork exige plano **Beginner** (Free = 1 sandbox simultâneo, 10/dia).

### Cronograma (PT) com time de agentes

| Hora | Trilha 1: plataforma (migração) | Trilha 2: agente CreateOS (novo) | Trilha 3: Stripe (novo) |
|---|---|---|---|
| 12:30–14:00 | A1–A3: esqueleto, carteira→`userId`, runtime sem chain | `sandbox/` (client, pool, fork, egress) como módulo independente + pacote `agents/createos` com `verify` | `payments/providers/stripe.ts` + webhook idempotente, testado com `stripe listen` |
| 14:00–15:00 | Integração: tools `sandbox_run`/`sandbox_preview`, gates `verify` no `engine.ts`, Checkout na web | ← | ← |
| 15:00–16:00 | `stripe projects init` + createos + Postgres; deploy no CreateOS; MCP público no Claude.ai | | |
| 16:00–16:40 | Ensaio da demo, correções | | |
| 16:40–17:30 | Vídeo, README, repo público, post, formulário, leaderboard | | |

**Corte de segurança às 14:30 PT:** se a migração (Trilha 1) não estiver com `typecheck` verde, ou se os organizadores
disserem não, as Trilhas 2 e 3 viram um app novo e enxuto (web simples + loop do agente), sem perder trabalho, porque
foram escritas como módulos independentes. Demo só no Claude (ChatGPT fica fora do vídeo).

---

## 0. A tese em uma frase

> **Solvers: especialistas de IA que não só dizem o que fazer, mas provam.** Cada etapa do método tem um checklist, e os
> itens verificáveis rodam de verdade num sandbox do CreateOS antes de o Solver avançar. Compra por Stripe Checkout;
> agentes pagam por execução via Machine Payments Protocol da Stripe.

Hoje o manifesto do `backend-node` diz literalmente: *"It does not run your code"*. A migração vira esse limite na
história do pitch: com o CreateOS, o Solver passa a rodar o código, os testes e o deploy.

O que encaixa no tema do evento ("agente que escreve e roda o próprio código num sandbox do CreateOS"):

- O Claude (via conector MCP do Solvers) escreve o código; o servidor do Solvers roda no sandbox CreateOS e devolve stdout,
  stderr e exit code.
- Os gates do método podem exigir prova por execução (`exit 0`, testes passando, porta respondendo).
- Ideias do PDF que viram Solvers dentro do produto: **#01 Stripe Webhook Fixer**, **#14 agente que monta o próprio
  stack** (o Solver CreateOS) e **#16 Pay-per-run Code Runner** (MPP).

---

## 1. Decisões que são suas (antes de começar)

| # | Decisão | Recomendação | Por quê |
|---|---|---|---|
| D1 | **Código pré-existente é permitido?** A página diz "start from an empty directory"; o PDF diz "bring your own idea". | Perguntar **hoje** no Discord ou para gunjan@nodeops.xyz. Se a resposta for não, seguir a **Trilha B** (§3). | Desclassificação é o pior risco do plano. |
| D2 | Plano do CreateOS | **Beginner (US$ 10/mês)** via `stripe projects add createos/beginner-monthly` | O Free permite **1 sandbox simultâneo e 10 criações por dia**. Só desenvolver já gasta isso; a demo ao vivo pode falhar com `429`. Beginner: 5 simultâneos, 50/dia. |
| D3 | Banco | **Neon via Stripe Projects** (`stripe projects add neon/...`; confirmar o nome com `stripe projects catalog`) | Conta no leaderboard do Stripe Projects, tem pgvector e evita Docker local. Fallback: Postgres local em container na porta **5547**. |
| D4 | Login | **Link mágico por e-mail** (Resend, se estiver no catálogo do Stripe Projects) com fallback `DEV_LOGIN=1` que imprime o link no log | A carteira era a identidade; precisa de algo sem cripto que funcione na tela de consentimento do OAuth/MCP. |
| D5 | MPP (pay-per-run) | **Stretch**, só depois de o Checkout funcionar | Exige `STRIPE_PROFILE_ID` (perfil de rede da Stripe, API em preview) e o mínimo por cartão via SPT é US$ 0,50. Configurar **só SPT**, sem `depositAddresses` (senão volta stablecoin). |
| D6 | Moeda | **USD em centavos** | Hackathon em inglês, Stripe em test mode. Pix via Stripe fica para depois. |
| D7 | Repasse ao criador (Stripe Connect Express + `application_fee_amount`) | **Pós-hackathon** | Na demo todos os Solvers são da plataforma; o split de 10% continua no ledger. |
| D8 | Garantias (escrow por marcos) | **Cortar**; reconstruir depois como reembolso com aprovação humana (ideia #07 do PDF) | Todo o escrow era on-chain (`SolversEscrow`, `markPassed`). |
| D9 | Repositório remoto / deploy por GitHub | Você decide na hora | O deploy do CreateOS importa do GitHub (ou aceita upload manual ou imagem Docker). Push e repo público são ações externas. |

---

## 2. Arquitetura alvo

```
Claude / ChatGPT ──MCP (OAuth 2.1 + PKCE)──▶  apps/server (Express 5)
                                               ├─ mcp/        15 → 15 tools (2 de garantia saem, 2 de sandbox entram)
                                               ├─ runtime/    pacotes, método, gates, trial, templates
                                               ├─ sandbox/    NOVO: cliente CreateOS, pool por sessão, regras
                                               ├─ verifier/   runTests agora no CreateOS (antes: Docker)
                                               ├─ payments/   ledger + StripeProvider (Checkout + webhook)
                                               ├─ agent-pay/  NOVO: mppx/server com stripe.create (SPT)
                                               ├─ auth/ oauth/  usuário por e-mail; JWT sub = users.id
                                               └─ knowledge/ memory/ creator/ submissions/ review/ publish/ worker/
                                                     │
                       Postgres + pgvector (Neon) ◀──┘        CreateOS Sandbox (Firecracker, devbox:1)
apps/web (Next.js 16) ── catálogo, página do Solver, Stripe Checkout, biblioteca, /connect, /login
agents/<slug>          ── pacotes de dados (inclui o novo agents/createos)
Hospedagem: CreateOS deploy (API e web), URL pública *.createos.nodeops.network para o MCP
```

### O que sai (inteiro)

`contracts/`, `deployments/`, `packages/chain`, `packages/contracts-client`, `server/src/{chain,indexer,relay,
solana-pay,pix}`, o `agent-pay` atual (MPP sobre Tempo), escrow e garantias, créditos (`SolversCredits`), staking, cap de
licenças on-chain, royalty de transferência, transferência de licença, faucet, `wallet_persons`, SIWE, Privy.

### Portas e nomes deste projeto (não colidem com o `solvers-tempo`)

| | Valor |
|---|---|
| API dev | `3038` |
| Web dev | `3041` |
| Postgres local (fallback do D3) | container `solvers-createos-pg` na **5547**; DBs `solvers_createos`, `solvers_createos_test` |
| Nunca usar | 5433, 5543, 5544, 5546, 3018, 3001, 4018, 3028 |

---

## 3. Duas trilhas, conforme a resposta da D1

**Trilha A: código existente permitido.** O desacoplamento da blockchain (§5, fases A1–A4) é feito **hoje à noite e
amanhã de manhã**, porque é trabalho mecânico no seu próprio produto. As 5h30 do evento ficam para o que é nativo do
hackathon: Stripe Projects, sandbox CreateOS, Stripe Checkout/MPP, Solver CreateOS, deploy e demo (fases E1–E6).

**Trilha B: diretório vazio obrigatório.** Hoje à noite **nada de código**: só contas, chaves, leitura das docs e este
plano. No evento, monta-se um núcleo enxuto copiando apenas o mínimo (§4, coluna "B"), sem fluxo de criador, sem
reviews, sem memória criptografada e sem catálogo completo. O resto da migração vira pós-hackathon.

Em ambas as trilhas, o repositório novo nasce com `git init` local neste diretório. Nada é empurrado para remoto sem a
sua decisão (D9).

---

## 4. Manifesto de cópia (solvers-tempo → Solvers CreateOS)

Legenda: **C** = copia como está · **A** = copia e adapta · **R** = substitui · **—** = não entra.
Coluna **B** = entra também na Trilha B (núcleo mínimo).

### Raiz e pacotes

| Origem | Destino | Ação | B | Observação |
|---|---|---|---|---|
| `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig*.json` | raiz | A | ✓ | Tirar os workspaces `contracts`, `packages/chain`, `packages/contracts-client`, `scripts` de chain. |
| `packages/shared` | `packages/shared` | A | ✓ | Manter `schemas`, `rules`, `locales`, `submissions`, `publication`, `extras`, `money.ts`. Apagar `evm.ts` (único com viem), `onchain.ts`, campos `Call`/`Address` de `payments.ts`. |
| `packages/api-client` | `packages/api-client` | A | | Tirar o import de `viem/siwe` (L103), as rotas `/tx/*`, `/relay` e o auth por SIWE, e os tipos `Address`. |
| `packages/chain`, `packages/contracts-client`, `contracts/`, `deployments/` | — | — | | |
| `agents/backend-node`, `frontend-react`, demais | `agents/` | A | 1–2 | Tirar `pricing.royaltyBps`, `supply`, `guarantee`; renomear `priceUsdc` → `priceCents`. |
| `PACKAGE_SPEC.md` (raiz) | `docs/package-spec.md` | A | | Documentar `steps[].verify` (§6.3). |

### Servidor (`server/src/...` → `apps/server/src/...`)

| Módulo | Ação | B | O que muda |
|---|---|---|---|
| `app.ts` | A | ✓ | Tirar mounts de relay, pix e webhooks antigos; rate limit por `userId`; montar `POST /api/stripe/webhook` com `express.raw({ type: "application/json" })` **antes** do `express.json()`. |
| `modules.ts` | A | ✓ | Manter oauth, mcp, me, creator, publish, images, help. Tirar escrow, creator-tx, solana-pay, agent-pay antigo, governance hook. Somar `sandbox`, `stripe`, `agent-pay` novo. |
| `jobs.ts` | R | ✓ | Só: limpeza de submissions, delist por nota baixa, **destruir sandboxes ociosos**, reconciliar Checkout Sessions pendentes. |
| `env.ts` | A | ✓ | Apagar blocos de chain, Privy, Mercado Pago, Solana e MPP-Tempo. Ver §7. |
| `index.ts` | A | ✓ | Tirar `initChain` e `reconcileSentTxs`. |
| `auth/jwt.ts` | A | ✓ | `sub = users.id`; `req.wallet` → `req.userId`. |
| `auth/person.ts` | C | | Dedup por e-mail; agora a identidade principal. |
| `auth/siwe*`, `auth/privy.ts` | R | ✓ | `auth/magic-link.ts`: `POST /api/auth/email` (gera token de uso único, hash no DB, TTL 15 min), `GET /api/auth/verify?token=` (cria sessão, cookie `solvers_session`). |
| `oauth/` | A | ✓ | `/connect` conclui com a sessão web (sem assinatura). Tirar `/authorize/extension`, `/authorize/nonce`, `/agent/*`. `issueTokens(clientId, userId)`. |
| `mcp/` | A | ✓ | `bearer` (`mcp/routes.ts:21-40`) põe `req.userId`. `agent-text.ts`: tirar `networkLabel`. Textos de compra (`mcp/tools.ts` L326-438, "approve in your wallet") → "abra o link do Stripe Checkout". Tirar `list_open_guarantees` e `submit_deliverable`. Somar `sandbox_run` e `sandbox_preview` (§6.2). |
| `runtime/access.ts` | A | ✓ | `licenseCheck` (L24-46): consulta só o DB, sem `refreshLicenseOwner`/`findUnindexedLicenses`. Apagar acesso por escrow (L49-60). Trial (L114-150) fica. |
| `runtime/licenses.ts` | — | | `ownerOf` e scan de logs. |
| `runtime/engine.ts` | A | ✓ | Rekey; em `getSession` (L99-145) tirar a rechecagem on-chain do dono. Avaliar `steps[].verify` antes de avançar (§6.3). |
| `runtime/trial.ts`, `package-loader.ts`, `manifest.ts`, `tools.ts`, `tool-fns.ts`, `templates.ts`, `platform-agents.ts`, `validate/`, `packages.ts`, `package-paths.ts`, `session-rules.ts`, `availability.ts`, `differentiators.ts`, `agent-ids.ts`, `memory-access.ts` | C | ✓ | `manifest.ts`: campos de preço e `verify` (A). `tools.ts`: `builtin:docker-react-test` chama `runTests` e passa a rodar no CreateOS sem mudança. |
| `runtime/guarantees.ts`, `guarantee-text.ts` | — | | |
| `knowledge/` | C | ✓ | `quota.ts`: renomear chave para `userId`. Embeddings locais e5 continuam. |
| `memory/rules.ts` | C | | |
| `memory/crypto.ts` | A | | A chave vinha de HKDF(assinatura da carteira). Agora: DEK aleatória por usuário, embrulhada com `MEMORY_KEK` (AES-256-GCM), guardada em `memory_keys`. |
| `store/catalog.ts`, `mappers.ts`, `help*`, `images*`, `lang-rules`, `fx.ts`, `dashboard-rules`, `review-rules`, `profile.ts` | C/A | parcial | Rekey onde houver carteira. |
| `store/routes.ts`, `me.ts` | A | ✓ | Manter `/agents`, `/search`, `/creators`, `/me/licenses`, `/me/access`, `/me/trials`, `/me/usage`. Tirar `/tx/*`, `/faucet`, `/me/balance`, `/me/payouts`, `/license/:id`, `transfer-quote`, `memory-key`. |
| `store/chain-reads`, `creator-tx`, `tx-build`, `simulation-gate`, `escrow*`, `dispute-drafts`, `guarantee-holds`, `pause-*`, `fresh-price`, `supply-rules` | — | | `public-config` é reescrito. |
| `payments/ledger.ts`, `lifecycle.ts`, `registry.ts`, `routes.ts`, `export.ts`, `alerts.ts`, `providers/fake.ts` | C | ✓ | Interface `PaymentProvider` em `packages/shared/src/payments.ts:119`. |
| `payments/platform-provider.ts`, `intent.ts` | A | ✓ | Ler agente, preço mínimo e pausa do DB (sem `readAgent`/`readMinPrice`/`readPauseFlags` on-chain). |
| `payments/providers/stripe.ts` | **novo** | ✓ | §6.4. |
| `payments/chain.ts`, `fulfil.ts`, `float.ts`, `hooks.ts`, `sale-hook.ts`, `escrow-plan.ts`, `providers/direct-wallet.ts`, `stubs.ts` | — | | |
| `creator/`, `submissions/`, `worker/`, `review/` | C/A | | Rekey de `creatorWallet`, `reviewerWallet`. `review/` e `worker/` vão como estão. |
| `publish/fs.ts`, `catalog*.ts`, `finalize.ts`, `admin*.ts`, `suspend.ts` | A | ✓ (fs, catalog, finalize) | Tirar os passos de chain do `finalize`; `ADMIN_WALLETS` → `ADMIN_USER_IDS`; aprovar = mudança de estado no DB (o caminho de `cli/publish.ts --no-chain`, L8-10); suspender = só DB. |
| `publish/chain-port.ts`, `tx.ts`, `reconcile.ts`, `approve.ts` | — | | |
| `verifier/report.ts`, `safe-read.ts`, `install.ts`, `preview.ts` | C | ✓ | |
| `verifier/sandbox.ts` | R | ✓ | Corpo de `runTests` (L179) troca `docker()` pelo CreateOS mantendo o contrato `RunResult` (§6.5). |
| `verifier/deliverables.ts` | — | | Era o `markPassed` do escrow. |
| `notify/`, `telegram/`, `images/` | C | | |
| `lib/http.ts`, `jobs.ts`, `crypto.ts` | C | ✓ | |
| `lib/money.ts` | A | ✓ | Base em centavos (2 casas) em vez de 6 decimais. |
| `cli/images.ts`, `invite.ts`, `ledger-export.ts`, `schema.ts`, `validate.ts`, `seed.ts` | C/A | seed ✓ | Tirar chain do `seed`. |
| `cli/publish.ts`, `suspend.ts` | A | publish ✓ | Só o caminho sem chain. |
| `cli/admin*`, `approve.ts`, `cli-chain.ts`, `reindex.ts`, `treasury-status.ts`, `wallet-send.ts` | — | | |
| `chain/`, `indexer/`, `relay/`, `solana-pay/`, `pix/`, `agent-pay/` (atual) | — | | `pix/mercadopago.ts` serve só de referência para verificação de assinatura de webhook. |

### Banco (`server/src/db/schema.ts`)

Em vez de migrar o banco antigo, nasce **uma baseline nova** (`0000_baseline.sql` gerado por `drizzle-kit generate`).

- **Tabela nova `users`**: `id uuid pk`, `email citext unique`, `email_verified_at`, `created_at`. Mais
  `login_tokens(id, user_id, token_hash, expires_at, used_at)`.
- **Tabelas que saem**: `processed_events` (substituída por `stripe_events`), `indexer_failures`, `chain_txs`, `sent_txs`,
  `relay_log`, `usage_batches`, `payouts_deferred`, `escrows`, `milestones`, `auth_nonces`, `wallet_persons`, `credits`,
  `kv`.
- **Colunas de carteira → `user_id uuid references users(id)`**: `creators.wallet`, `creator_invites.wallet`,
  `package_submissions.creator_wallet`, `package_reviews.reviewer_wallet`, `licenses.owner_wallet`, `trials.wallet`,
  `reviews.author_wallet`, `review_drafts.author_wallet`, `user_profiles.wallet` (PK), `user_reputation.wallet`,
  `usage_events.wallet`, `sessions.wallet`, `oauth_codes.wallet`, `oauth_tokens.wallet`, `memory_keys.wallet`,
  `memories.wallet`, `escalations.wallet`, `payment_ledger.buyer_wallet` e `payer_wallet`.
- **Colunas de chain que saem**: `licenses.id` vira `uuid` (era o tokenId ERC-721), `licenses.tx_hash`,
  `licenses.review_id` (continua, mas aponta para a review no DB), `agents.chain_index`, `agents.sync_flag`,
  `agents.price_per_use`, `agents.status` (fica `platform_status`), `reviews.token_id`, `reviews.onchain`, colunas de tx de
  `package_submissions`, `payment_ledger.purchase_id`, `token_address`, `tx_hash`, `log_index`, `ref`.
- **Colunas novas**:
  - `licenses.stripe_checkout_session_id text unique` (idempotência da compra).
  - `payment_ledger.provider_ref text unique` (Checkout Session ou PaymentIntent), `currency text`, valores em
    `amount_cents bigint`.
  - `stripe_events(id text pk, type, received_at, processed_at)`: dedupe de webhooks.
  - `sandboxes(id uuid pk, user_id, session_id, createos_id, status, created_at, last_used_at, runs int)`.
  - `sandbox_runs(id, sandbox_id, user_id, agent_id, command, exit_code, exec_ms, stdout_bytes, paid_via, created_at)`.
- **Ficam**: `version_hash`, `knowledge_chunks`, `agent_search_vectors`, `oauth_clients`, `agent_images`, `ingest_jobs`,
  `agent_published_versions`.

### Web (`web/src/...` → `apps/web/src/...`)

| Ação | Arquivos |
|---|---|
| **C** | `app/[locale]/page.tsx` (home/catálogo), `components/catalog/*`, `components/ui/*`, `solvers/[slug]/page.tsx` (tirar o link `addressUrl` do explorer), `library/page.tsx`, `TrialsSection`, `checkout/InstallView.tsx`, `install/page.tsx`, telas de upload de ZIP, submissions, dashboard do criador, `admin/reviews`, i18n (`en` + `pt`). |
| **A** | `BuyBox` (`sameAddress` → comparação de id), `Licenses.tsx` (sem transferência), `LibraryShell` (sem `BalanceChip`), `account/Memories.tsx`, `Profile.tsx`. |
| **R** | `lib/session.tsx` (sessão por cookie de link mágico), `layout/Header.tsx` e `SwitchAccount.tsx` (e-mail no lugar da carteira), `checkout/CheckoutView.tsx` + `glue.ts` + `rules.ts` (botão que chama `POST /api/checkout` e redireciona para `session.url`), `connect/ConnectView.tsx` (consentimento sem assinatura), página nova `login/`. |
| **—** | `lib/wallet/*`, `lib/tx.ts`, `checkout/PixPanel.tsx`, `SolanaPayPanel.tsx`, `account/account-tx.ts`, `TransferLicenseDialog`, `WalletSummary`, `EscrowCard`, `Guarantees`, `creator/CoSign.tsx`, `creator/creator-tx.ts`, `dev/kit`, `guarantees/`. |

Ler `apps/web/AGENTS.md` e `apps/web/node_modules/next/dist/docs/` antes de mexer no Next 16 (ele difere do que os
modelos conhecem).

---

## 5. Fases de trabalho

Horários do evento em **Brasília**. "T+" conta a partir do início do build (16h30 BRT = 12h30 PT).

### Hoje à noite (ambas as trilhas): preparação sem código

1. Aplicar no Luma (exige aprovação) e entrar no Discord. Fazer a pergunta da D1.
2. Stripe: conta em **test mode**; Stripe CLI **≥ 1.43.3**; `stripe login`; `stripe plugin install projects`.
3. CreateOS: conta, API key em `https://createos.sh/app/profile`, `createos login`, conferir com
   `curl -H "X-Api-Key: $KEY" https://api-eu.sb.createos.sh/v1/whoami`. Decidir o plano (D2).
4. Smoke de 2 minutos com o SDK num diretório de rascunho (não no repo): criar sandbox `devbox:1`, `runCommand("node",
   ["-v"])`, `destroy()`. Confirma chave, cota e latência. Gasta 1 das 10 criações do Free.
5. `stripe projects catalog` e `stripe projects search postgres|email|auth`: anotar os nomes reais dos serviços (Neon,
   Resend) e **quais variáveis** cada um injeta no `.env` (a doc do CreateOS não lista; ver §9).
6. Para o MPP (D5): pegar o `profile_` em `GET https://api.stripe.com/v2/network/business_profiles/me` com header
   `Stripe-Version: 2026-07-29.preview`. Se não houver acesso, o MPP sai do escopo.

### Trilha A, antes do evento: desacoplar a blockchain

**A1. Esqueleto (≈1h).** `git init`; copiar raiz, `packages/shared`, `packages/api-client`, `apps/server`, `apps/web`,
`agents/` conforme §4; apagar o que é "—"; ajustar workspaces. Critério: `pnpm install` passa.

**A2. Identidade (≈3h, a parte mais longa).**
- Baseline nova do schema (§4 Banco), `users` + `login_tokens`.
- Codemod guiado por busca, não cego: `rg -n "wallet|Wallet|ownerWallet|req\.wallet|addr\(" apps packages` e trocar por
  `userId` arquivo a arquivo. Tipos `Address` → `string` (uuid).
- `auth/magic-link.ts`, `auth/jwt.ts` (`sub=userId`), `oauth/` (`issueTokens(clientId, userId)`, `/connect` sem
  assinatura), `mcp/routes.ts` (`req.userId`).
- `memory/crypto.ts` com DEK por usuário + `MEMORY_KEK`.
- Critério: `pnpm typecheck` passa; login por link mágico abre sessão; o fluxo OAuth do MCP emite token com `sub` = uuid.

**A3. Runtime e acesso sem chain (≈1h30).** `runtime/access.ts`, `engine.ts`, `manifest.ts` (preço em centavos, sem
royalty, supply e guarantee); tools do MCP sem garantias; textos de compra. Critério: `activate_solver` com trial funciona
ponta a ponta contra o DB; os testes copiados do runtime passam.

**A4. Portão "zero cripto" (≈30 min).** Script `scripts/crypto-free-check.mjs`, rodado no CI e antes de cada commit:

```bash
rg -n -i "viem|siwe|privy|wallet|tempo|blockchain|on-?chain|nft|erc-?721|token_?id|tx_?hash|usdc|stablecoin|solana|mint|relay|indexer" \
  apps packages agents --glob '!**/node_modules/**' --glob '!docs/migration/**'
```

Deve voltar vazio (exceções explícitas numa allowlist, por exemplo a palavra "mint" num texto de marketing). Critério:
`pnpm build && pnpm typecheck && pnpm test` verdes e o portão vazio.

### Durante o evento (Trilha A; a Trilha B faz E0 primeiro)

**E0 (só Trilha B, T+0:00–1:30).** Diretório vazio → copiar a coluna **B** do §4 e fazer A2/A3 reduzidos: sem creator,
submissions, reviews, memória e catálogo completo. Um Solver de plataforma em `PLATFORM_AGENTS` + o Solver CreateOS.
Desloca as fases abaixo em 1h30 e corta E5 para o mínimo.

**E1. Stack pelo Stripe Projects (T+0:00–0:20).**
```bash
stripe projects init
stripe projects add createos/project          # ou createos/beginner-monthly (D2)
stripe projects add neon/<serviço>            # nome conferido na véspera
stripe projects env --pull                    # .env com credenciais (600, já no .gitignore)
pnpm --filter @solvers/server db:migrate && pnpm --filter @solvers/server cli:publish --no-chain
```
Critério: API sobe na 3038, catálogo lista os Solvers.

**E2. Módulo `sandbox/` + tools do MCP (T+0:20–1:50).** §6.1–6.3. Critério: no Claude, `sandbox_run` executa
`node -e "console.log(1+1)"` e devolve `2`; um gate com `verify` bloqueia o avanço com exit ≠ 0 e libera com exit 0.

**E3. Verifier no CreateOS (T+1:50–2:20).** §6.5. Critério: `builtin:docker-react-test` do `frontend-react` roda os
testes Vitest no sandbox e devolve o mesmo `RunResult`.

**E4. Stripe Checkout + webhook (T+2:20–3:20).** §6.4. Testar com
`stripe listen --forward-to localhost:3038/api/stripe/webhook` e cartão `4242 4242 4242 4242`. Critério: comprar na web
→ a licença aparece em `/library` e `activate_solver` passa a liberar todas as etapas; reenviar o mesmo evento
(`stripe events resend`) não cria segunda licença.

**E5. Solver CreateOS (T+3:20–4:20).** §6.6. Critério: o pacote passa em `cli:validate` e o Claude conduz um projeto do
zero até uma URL de preview no sandbox.

**E6. Deploy + MPP (stretch) + demo (T+4:20–5:30).**
- Deploy no CreateOS: API (porta 3038, `pnpm --filter @solvers/server start`) e web (Next.js). Variáveis no passo de
  build settings. Atualizar `PUBLIC_API_URL`/`PUBLIC_WEB_URL` e o endpoint do webhook na Stripe (test mode) para a URL
  pública.
- Conectar o MCP público no Claude.ai e ensaiar a demo (§8) **duas vezes**, cronometrada.
- MPP (§6.7) só se E1–E5 estiverem verdes até T+4:20.
- Submeter no leaderboard do Stripe Projects antes de 18h PT (22h BRT).

### Pós-hackathon (completar a migração)

1. Trazer o que ficou de fora na Trilha B (creator flow, reviews, memória, catálogo completo).
2. Stripe Connect Express para criadores: onboarding com `accounts.create` + `accountLinks.create`, destination charges com
   `payment_intent_data[application_fee_amount]` (10%, piso, como em `shared/money.ts:49 feeSplit`) e
   `transfer_data[destination]`. Reembolso com `reverse_transfer=true` + `refund_application_fee=true`.
3. Reviews só de quem tem licença (regra que era do contrato `SolversReviews`), agora no DB com constraint.
4. Garantias como reembolso com teto e aprovação humana (D8).
5. Pix pela Stripe para o Brasil (avaliar), e textos `pt`.
6. Questões fiscais e legais em `docs/payments-open-questions.md`, sem conclusões no código.

---

## 6. Especificação das peças novas

### 6.1 `apps/server/src/sandbox/`

| Arquivo | Conteúdo |
|---|---|
| `client.ts` | Wrapper fino de `@nodeops-createos/sandbox` (`createClient({ apiKey })`). Interface `SandboxPort` com `create`, `connect`, `run`, `upload`, `download`, `preview`, `destroy`, para trocar por um fake nos testes. |
| `pool.ts` | Um sandbox por `(userId, sessionId)`. Reusa por `Sandbox.connect(createosId)`; cria se não houver. `auto_pause_after_seconds: 300`. Job destrói os ociosos há mais de 30 min. `destroy()` sempre em `finally` nos caminhos de erro. Fila quando bater o limite de concorrência do plano (`429`). |
| `rules.ts` (puro, com testes `node:test`) | Truncagem de saída (o `exec` corta em 1 MiB; devolver ao modelo no máximo ~16 KB por stream, com aviso de truncado), allowlist de egress por Solver, validação de caminhos (só dentro de `/workspace`), limites por trial. |
| `fake.ts` | `SandboxPort` em memória para testes e para `SANDBOX_MODE=simulated`. |

Configuração padrão de criação:

```ts
const sandbox = await client.createSandbox({
  shape: "s-1vcpu-1gb",          // o maior do Free; s-2vcpu-2gb ou mais no Beginner
  rootfs: "devbox:1",            // Node 24, Python 3.12, Bun, Go, Rust; o padrão do catálogo é alpine, então é explícito
  egress: ["registry.npmjs.org:443", "pypi.org:443", "*.pythonhosted.org:443", "github.com:443"],
  auto_pause_after_seconds: 300,
});
```

Segurança: a API key do CreateOS fica só no servidor; nenhum segredo do usuário entra no sandbox; ingress só ligado quando
`sandbox_preview` é chamado; egress fechado por allowlist (com qualquer regra, o resto é negado).

### 6.2 Tools novas do MCP

| Tool | Entrada | Saída | Regras |
|---|---|---|---|
| `sandbox_run` | `session_id`, `files?: [{ path, content }]` (upload antes), `command`, `args?`, `timeout_ms?` (máx. 300 000) | `stdout`, `stderr`, `exit_code`, `exec_ms`, `truncated` | Exige sessão ativa de um Solver com acesso (licença ou trial). Trial: N execuções (`manifest.trial.toolLimits`). Registra em `sandbox_runs`. |
| `sandbox_preview` | `session_id`, `port` | URL pública | `setIngress(true)`, `waitForPortReady(port)`, `previewUrl(port)`. |

`submit_deliverable` e `list_open_guarantees` saem (D8). As instruções do servidor MCP ganham uma linha: código do usuário
roda só via `sandbox_run`, nunca na máquina do usuário.

### 6.3 Gates provados por execução (`steps[].verify`)

Extensão do manifesto (`runtime/manifest.ts:32`):

```jsonc
{
  "file": "steps/04-deploy.md",
  "title": "Deploy and prove it runs",
  "gate": ["Build passes in the sandbox", "Health endpoint answers 200"],
  "verify": [
    { "label": "Build passes in the sandbox", "command": "bash", "args": ["-lc", "cd /workspace && npm run build"], "expectExit": 0 },
    { "label": "Health endpoint answers 200", "command": "bash", "args": ["-lc", "curl -fsS localhost:3000/health"], "expectExit": 0 }
  ]
}
```

No `next_step`, antes de avançar, o `engine.ts` roda cada `verify` no sandbox da sessão. Falhou: devolve o stderr e não
avança. Passou: grava a prova (comando, exit code, `exec_ms`) e mostra na resposta. É o diferencial da demo: o checklist
deixa de ser declarativo.

### 6.4 Stripe Checkout + webhook (`payments/providers/stripe.ts`)

Fluxo:

1. `POST /api/checkout { agentSlug }` (exige sessão) → `PlatformProvider.createCharge` cria a linha do ledger em
   `pending` e uma Checkout Session:
   ```ts
   const session = await stripe.checkout.sessions.create({
     mode: "payment",
     line_items: [{ price_data: { currency: "usd", unit_amount: agent.priceCents,
       product_data: { name: agent.name } }, quantity: 1 }],
     customer_email: user.email,
     client_reference_id: ledgerId,
     metadata: { ledgerId, agentId: agent.id, userId: user.id },
     success_url: `${PUBLIC_WEB_URL}/library?bought=${agent.slug}`,
     cancel_url: `${PUBLIC_WEB_URL}/solvers/${agent.slug}`,
   }, { idempotencyKey: ledgerId });
   ```
   Responde `{ url: session.url }`; a web redireciona.
2. `POST /api/stripe/webhook` (corpo cru): `stripe.webhooks.constructEvent(rawBody, req.headers["stripe-signature"],
   STRIPE_WEBHOOK_SECRET)`. Insere em `stripe_events` (`on conflict do nothing`; se já existia, responde 200 e sai).
3. Em `checkout.session.completed` com `payment_status === "paid"`: **uma transação** que move o ledger para `fulfilled`
   e insere a licença (`stripe_checkout_session_id` unique). Isso junta os dois passos de hoje (`payments/fulfil.ts:66
   applySale` + `indexer/sync.ts:352 → license-mirror.ts:33 upsertLicenseRow`).
4. `checkout.session.async_payment_succeeded` / `_failed` e `checkout.session.expired` atualizam o ledger.
5. Job de reconciliação: Checkout Sessions `pending` há mais de 1h são consultadas na API e corrigidas.
6. Regras que continuam: preço mínimo de US$ 5 (`500` centavos) por compra; taxa de 10% da plataforma com piso e resto ao
   criador, registrada no ledger (repasse real só com Connect, pós-hackathon).

### 6.5 Verifier no CreateOS (`verifier/sandbox.ts`)

Manter a assinatura `runTests(files, { acceptance, image })` e o `RunResult`. Novo corpo:

1. `pool` cria um sandbox **efêmero** (não o da sessão), `devbox:1`, egress só `registry.npmjs.org:443`.
2. `sandbox.sh("mkdir -p /workspace/src /workspace/report")`; `files.upload` de cada arquivo (diretórios precisam
   existir).
3. Instalar e testar:
   `sandbox.runCommand("bash", ["-lc", "cd /workspace && npm ci --ignore-scripts && npx vitest run --reporter=json --outputFile=report/vitest.json"], { timeoutMs: 300_000 })`.
4. `files.download("/workspace/report/vitest.json")` e, se houver, `preview.html` → `evaluateReport` (`report.ts`) igual
   a hoje.
5. `destroy()` em `finally`. `VERIFIER_MODE=createos|simulated` substitui `docker|simulated`.

O Dockerfile em `agents/frontend-react/verifier/` vira referência para um template custom (`POST /v1/templates`), que não
existe no plano Free; com `devbox:1` instalamos as dependências por execução.

### 6.6 O Solver CreateOS (`agents/createos/`)

- **Nome**: "CreateOS Builder". Tagline: *"From a one-line spec to a running, paid app on CreateOS, with every step proven
  in a sandbox."*
- **Método (5 etapas, cada uma com gate e `verify`)**:
  1. **Spec e stack**: entender a ideia, escolher runtime e serviços; gerar o plano de `stripe projects add ...`.
     Gate: spec confirmada; lista de serviços com o comando de cada um.
  2. **Scaffold no sandbox**: criar o projeto em `/workspace`. `verify`: `node -v` e `npm install` com exit 0.
  3. **Código + testes**: implementar e escrever testes. `verify`: `npm test` com exit 0.
  4. **Pagamento**: Stripe Checkout em test mode com webhook verificado. `verify`: teste de assinatura de webhook passa.
  5. **Preview e deploy**: subir o servidor, abrir `sandbox_preview`; checklist de deploy no CreateOS (porta, build e run
     commands, variáveis). `verify`: `curl -fsS localhost:<porta>/health` com exit 0.
- **Knowledge** (`knowledge/*.md`, cada arquivo com fonte e data de 16/10/2026): SDK do Sandbox (métodos e retornos),
  limites e planos, rede (egress/ingress), deploy no CreateOS, Stripe Projects (comandos), Checkout + webhooks, MPP.
- **Templates**: esqueleto Express + Checkout + webhook; esqueleto do cliente do sandbox; checklist de deploy.
- **Tools**: `sandbox_run`, `sandbox_preview` (via tools do MCP).
- **Trial**: 2 etapas e 5 execuções no sandbox. **Preço**: US$ 9 (900 centavos).
- **Evals** (`evals/cases/*.json`, uns 6): pedidos reais ("API de lista de espera com pagamento de reserva") com critérios
  checados pelo `verify`. O rótulo continua "internal team test", nunca "verified".
- **Segundo Solver (se sobrar tempo)**: "Stripe Webhook Fixer" (ideia #01): dispara `stripe trigger <evento>` contra o
  handler no sandbox, lê o erro, corrige, repete até todos passarem.

### 6.7 MPP pay-per-run (stretch, `agent-pay/`)

Rota `POST /api/agent/run` cobrando por execução no sandbox, para agentes sem conta:

```ts
import crypto from "crypto";
import StripeClient from "stripe";
import { Mppx, stripe } from "mppx/server";

const stripeClient = new StripeClient(env.STRIPE_SECRET_KEY);
const mppx = Mppx.create({
  methods: stripe.create({
    client: stripeClient,
    networkId: env.STRIPE_PROFILE_ID,
    livemode: !env.STRIPE_SECRET_KEY.includes("_test_"),
    // sem depositAddresses: só cartão via Shared Payment Token, nada de stablecoin
  }).defaultMethods(),
  secretKey: crypto.createHmac("sha256", env.STRIPE_SECRET_KEY).update("mpp-challenge-signing").digest("base64"),
});
// handler: const r = await mppx.charge({ amount: "0.50" })(request); if (r.status === 402) return r.challenge; ...
```

O `mppx` usa a API de `Request`/`Response` do fetch: adaptar o Express com um conversor (o `agent-pay/mpp.ts:26-50` atual
já faz isso com `chargeOrder()`; reaproveitar a ponte, trocando o método `tempo.charge` por `stripe.create`). Testar com
`npx mppx@latest validate http://localhost:3038` e `npx @stripe/link-cli mpp pay ...`. Conferir antes se o `mppx` 0.13.x
exporta `stripe` em `mppx/server`; a doc cita `hostedFeePayer` a partir da 0.9.2. Preço: US$ 0,50 por execução (o mínimo
do SPT).

---

## 7. Variáveis de ambiente (`infra/.env.example`)

```bash
# app
NODE_ENV=development
PORT=3038
PUBLIC_API_URL=http://localhost:3038
PUBLIC_WEB_URL=http://localhost:3041
DATABASE_URL=                 # Neon via Stripe Projects (ou postgres://...@localhost:5547/solvers_createos)
TEST_DATABASE_URL=            # só o banco descartável de teste
JWT_SECRET=                   # 32+ bytes aleatórios
MEMORY_KEK=                   # 32 bytes base64, embrulha a DEK de memória de cada usuário
ADMIN_USER_IDS=               # uuids separados por vírgula
DEV_LOGIN=0                   # 1 = imprime o link mágico no log (só dev/demo)
RESEND_API_KEY=               # se o e-mail vier pelo Stripe Projects
# stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PROFILE_ID=            # profile_..., só para MPP
# createos
CREATEOS_SANDBOX_API_KEY=
CREATEOS_SANDBOX_BASE_URL=https://api-eu.sb.createos.sh   # URL indicada pelos organizadores (a doc cita api.sb.createos.sh)
SANDBOX_MODE=createos         # createos | simulated
VERIFIER_MODE=createos        # createos | simulated
SANDBOX_SHAPE=s-1vcpu-1gb
```

`env.ts` (zod) é a fonte da verdade. Chaves e `.env*` nunca entram no git.

---

## 8. Roteiro da demo (2 minutos)

1. **0:00–0:15 Gancho.** "Especialistas de IA dão conselho. O nosso prova: cada passo do método roda num sandbox do
   CreateOS antes de seguir."
2. **0:15–0:45 Compra.** Catálogo → CreateOS Builder → Stripe Checkout (4242) → licença na biblioteca.
3. **0:45–1:35 Execução.** No Claude.ai, com o conector Solvers: "Faça uma API de lista de espera com reserva paga."
   Mostrar um gate **falhando** (teste vermelho, stderr do sandbox) e o Claude corrigindo até `exit 0`; abrir a URL do
   `sandbox_preview`.
4. **1:35–1:50 Agentes pagam sozinhos (se o MPP entrou).** `link-cli mpp pay` → 402 → pagamento → resultado.
5. **1:50–2:00 Fecho.** Stack montado com Stripe Projects, rodando no CreateOS; marketplace aberto a criadores.

Plano B da demo: vídeo gravado do fluxo completo no fim da E5, caso a rede ou a cota do sandbox falhe ao vivo.

---

## 9. Riscos e o que ainda não foi verificado

| Risco | Mitigação |
|---|---|
| Elegibilidade do código pré-existente (D1) | Perguntar hoje; Trilha B pronta. |
| Cota do Free do CreateOS (1 simultâneo, 10/dia) | Plano Beginner (D2); reusar o sandbox da sessão; `SANDBOX_MODE=simulated` nos testes. |
| O rekey carteira → `userId` é maior do que parece (a carteira é a chave de tudo) | Fazer na véspera (Trilha A); codemod guiado por `rg`; `typecheck` como guia. |
| Acesso ao MPP (API de perfil em preview) | Stretch; a demo não depende dele. |
| `exec` corta a saída em 1 MiB | Truncar no servidor e usar `streamCommand` se precisar. |
| Embeddings locais (`@huggingface/transformers`) pesam no deploy | Pré-gerar os vetores no `cli:publish` e desligar a geração em runtime na demo, se o build no CreateOS ficar lento. |

**Não verificado** (conferir na véspera, na ordem):
1. Nomes exatos das variáveis que `stripe projects add createos/project` e o serviço de Postgres injetam no `.env`.
2. Formato da URL de `previewUrl()` e se o TLS do ingress fica pronto na hora (a doc sugere `scheme: "http"` se não).
3. Assinaturas de `client.getSandbox` e `client.listSandboxes` (página Client do SDK, não lida).
4. Se o deploy do CreateOS aceita monorepo pnpm, ou se é melhor publicar API e web como imagens Docker.
5. Se o `mppx` 0.13.x tem o método `stripe` em `mppx/server`.
6. Como funciona o "Stripe Projects leaderboard" (só aparece na página do evento).

---

## 10. Checklist de pronto

- [ ] `pnpm build && pnpm typecheck && pnpm test` verdes; `scripts/crypto-free-check.mjs` vazio.
- [ ] Login por link mágico; conector MCP conecta no Claude.ai pela URL pública.
- [ ] Compra no Stripe Checkout (test mode) gera **uma** licença, mesmo com webhook reenviado.
- [ ] `sandbox_run` e `sandbox_preview` funcionando; sandboxes ociosos destruídos pelo job.
- [ ] Um gate com `verify` bloqueia e libera de verdade na demo.
- [ ] Verifier do `frontend-react` rodando no CreateOS.
- [ ] Solver CreateOS publicado com knowledge datado, templates e evals.
- [ ] API e web no ar no CreateOS; webhook da Stripe apontando para a URL pública.
- [ ] Demo ensaiada duas vezes; vídeo de backup gravado; submissão no leaderboard antes de 18h PT.

---

## Fontes

- Evento: https://luma.com/6stm74wk · PDF "Project Ideas: CreateOS x Stripe Hackathon" (24 ideias, 6 trilhas).
- CreateOS: https://createos.sh/docs/Sandbox/Quickstart · /Sandbox/Overview · /Sandbox/Limits ·
  /Sandbox/SDK/Reference/Sandbox · /Sandbox/SDK/Reference/Sandbox-Files · /Services/Stripe-Projects ·
  /Get-Started/Deploy-Github-Project · /Build-Deploy/Deploy · /Services/Database-CreateOS · /API-MCP/CreateOS-MCP ·
  https://github.com/NodeOps-app/createos-sandbox-sdk
- Stripe: https://docs.stripe.com/projects · /payments/machine/mpp · /agentic-commerce/concepts/shared-payment-tokens ·
  /checkout/quickstart · /webhooks · /cli/listen · /connect/destination-charges
- Mapa de acoplamento do `solvers-tempo`: levantado em 16/10/2026 a partir do código (referências de linha no §4 e §6).
