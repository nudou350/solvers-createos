# App spec and stack (one screen)

Fill this in during step 1 and confirm it with the user before writing any code. Keep it short: if a line needs more than two sentences, the scope is too big for one session.

```
idea:        <the user's one line, verbatim>
users:       <who uses it, and who pays>
must_have:   <3 to 5 behaviors, each testable, e.g. "POST /waitlist with an email returns 201 and a position">
not_now:     <what is explicitly out of this first version>
payment:     <what is sold, price in integer cents, one-off or recurring; "none" if no payment>
runtime:     <Node 24 + Express 5 (default) | Python 3.12 + FastAPI | other, with the reason>
port:        3000
data:        <in-memory for the demo | Postgres via Stripe Projects>
endpoints:   <METHOD /path -> status codes>, one per line
tests:       <one line per must_have, naming the test file>
```

## Services and provisioning commands

| Service | Why the app needs it | Command the user runs (own machine) | Env vars it produces |
|---|---|---|---|
| Hosting | run the app with a public URL | `stripe projects add createos/<service from catalog>` (or deploy from GitHub in the CreateOS dashboard) | none |
| Payments | Checkout + webhook | Stripe account in test mode (Dashboard > API keys) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Database (optional) | keep data across restarts | `stripe projects add neon/postgres` | `DATABASE_URL` (name as printed by `stripe projects env`) |

Before the table is final: `stripe projects catalog <provider>` for every provider, and copy the exact `<provider>/<service>` slug. Never invent a slug.

## Sandbox plan

```
project dir:  /workspace/app
install:      npm install --no-audit --no-fund
test:         npm test            (webhook only: npm run test:webhook)
start:        npm start           (binds 0.0.0.0:<port>)
egress:       registry.npmjs.org, pypi.org, *.pythonhosted.org, github.com, *.githubusercontent.com only
```
