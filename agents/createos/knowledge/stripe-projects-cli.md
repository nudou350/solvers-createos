---
title: Stripe Projects CLI: provision services (hosting, database, auth) and pull credentials into .env
source: Stripe documentation (Stripe Projects)
source_url: https://docs.stripe.com/projects
source_date: 2026-10-17
valid_until: 2027-01-15
tags: [stripe, projects, cli, provisioning, env, createos, neon]
---

## What it is

Stripe Projects provisions and manages third-party services (hosting, databases, auth, AI, observability; 60+ providers) from the terminal: it creates or links the provider account, provisions the resource, syncs the credentials to `.env` and bills through Stripe. **CreateOS is in the catalog** (category Compute).

## Install

Stripe CLI v1.43.3 or later, then the plugin:

```
npm install -g @stripe/cli
stripe plugin install projects
```

## The commands you will put in the plan

```
stripe projects init [name]                   # in the project folder; name defaults to the folder name
stripe projects catalog                       # browse providers and services
stripe projects catalog <provider> --json     # copy the exact <provider>/<service> slug from here
stripe projects add <provider>/<service>      # provision (add --name <resource> to name it)
stripe projects env                           # list variables, values redacted
stripe projects env --pull                    # write credentials to .env (mode 600) for the active environment
stripe projects status                        # providers, resources, tiers, health
```

Also available: `search <keyword>`, `link <provider>`, `remove <provider>/<service>`, `rotate <resource>`, `upgrade ...`, `open <provider>`, `list`, `pull <projectID>`, `env list|create|use ...`, `billing show|add|update`, `spend`. Global flags for agents and CI: `--json`, `--no-interactive`, `--auto-confirm`, `--accept-tos`, `--quiet`.

Documented examples of slugs: `neon/postgres`, `supabase/project`, `vercel/project`. **Never guess a slug**: tell the user to run `stripe projects catalog <provider>` and copy it. For CreateOS, the Solvers team's own project created resources named `createos-plan` and `createos-project` (default names follow `<provider>-<service>`), which points to a plan service plus a project service; confirm with `stripe projects catalog createos` before writing the final command. Providers with plans need the plan added before the deployable.

## State on disk

`.projects/state.json` (shared, commit it), `.projects/state.local.json`, `.projects/vault/vault.json` (encrypted, gitignored), `.projects/cache/`, and `.env` / `.env.*` (plaintext credentials, gitignored by `init`).

## How the Solver uses it

- In step 1, map each service in the spec to one line: `stripe projects add <provider>/<service>` + what it is for + which env var it produces. Only list services the app really needs; an in-memory store is fine for a demo.
- The user runs these commands **on their own machine**. You never run them in the sandbox (the sandbox has no Stripe CLI, no egress to Stripe, and must never hold the user's credentials).
- After `stripe projects env --pull`, the user copies the needed variables to CreateOS with `createos env set ...` or the dashboard. Never ask the user to paste key values into the chat.
