---
title: Deploying an app on CreateOS: GitHub, build and run settings, port, environment variables, logs
source: CreateOS docs (Build and Deploy, Deploy a GitHub project, CLI Getting Started, CLI Environment Variables, CLI Deployments)
source_url: https://createos.sh/docs/Build-Deploy/Deploy
source_date: 2026-10-17
valid_until: 2027-01-15
tags: [createos, deploy, github, build, port, env, logs, cli]
---

## Deploy methods

In the dashboard (`https://createos.sh/app/` > **Deploy**): **Import from GitHub** (recommended), **Deploy from Docker image**, **Upload a file** (ZIP) and **Deploy from template**. CreateOS auto-detects the framework; you can override the build and run commands. A "Build with AI" option detects the framework, configures build and run commands and assigns the server port.

## GitHub deploy: the fields

| Field | What to put for a Node/Express app from this Solver |
|---|---|
| Branch | `main` |
| Framework | Node.js |
| Server port | the port the app listens on, e.g. `3000` (the app must listen on this port) |
| Project name | becomes the subdomain, e.g. `myproject.createos.nodeops.network` |
| Build commands | `npm ci` (or `npm install` when there is no lockfile) |
| Run commands | `npm start` |
| Environment variables | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_URL`, any database URL |

The docs do not document an injected `PORT` variable, a default port, a runtime version field or a root-directory field. So: hard-code a default (`Number(process.env.PORT ?? 3000)`), set the same number in **Server port**, and bind to `0.0.0.0` (a safe default for any container router). Pin the Node version in `package.json` `engines` and check the build log.

After deploy, the project dashboard has: deployments, environments, analytics, **Modify Settings** (custom domains, build commands, environment variables), build and runtime logs, and rollback.

## CLI

Install: macOS/Linux `curl -sfL https://raw.githubusercontent.com/NodeOps-app/createos-cli/main/install.sh | sh -` or `brew tap nodeops-app/tap && brew install createos`; Windows: the binary from the GitHub releases page. Then:

```
createos login                 # browser; or: createos login --token <api key> (CI)
createos whoami
createos init                  # links the folder; writes .createos.json (gitignored)
createos deploy                # VCS projects deploy the latest commit; upload projects zip the folder
createos deploy --branch main | --image myapp:v1 | --dir ./dist | --project <id>
createos status
createos open
```

Environment variables:

```
createos env list [--hide]
createos env set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_...
createos env rm KEY
createos env pull              # writes .env.<environment>, adds .env.* to .gitignore
createos env push [--force]    # reads .env.<environment>
```

Deployments and logs:

```
createos deployments list
createos deployments logs [-f] [--interval 5s]
createos deployments build-logs
createos deployments retrigger
createos deployments wakeup    # resume a sleeping deployment
createos domains add myapp.com
```

The user runs these commands on their own machine, in their own terminal. You give them; you do not run them, and the user's keys never pass through the chat.

## Public URL

The dashboard docs give `<project>.createos.nodeops.network`; the CLI example prints `https://my-api.nodeops.app`. Read the real URL from `createos status` or the dashboard rather than guessing.

## After deploy: the Stripe webhook

1. In the Stripe Dashboard (test mode) > Developers > Webhooks, add an endpoint `https://<live-url>/webhook` listening to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
2. Copy its signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` with `createos env set`, then `createos deployments retrigger`.
3. Pay once with the test card `4242 4242 4242 4242` (any future date, any CVC) and confirm the order turns `paid`.
