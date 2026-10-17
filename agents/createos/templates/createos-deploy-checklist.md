# CreateOS deploy checklist

Fill in every line from what was **proven in the sandbox** (step 5), then hand it to the user. The user runs the commands on their own machine; never ask them to paste key values into the chat.

## 1. What was proven in the sandbox

| Item | Value | Proof |
|---|---|---|
| Runtime | Node `<node -v output>` | `node -v` exit 0 |
| Install | `npm install --no-audit --no-fund` | exit 0, `<exec_ms>` ms |
| Tests | `npm test`: `<n>` passing, 0 failing | exit 0 |
| Webhook signature tests | `npm run test:webhook`: `<n>` passing | exit 0 |
| Health | `curl -fsS localhost:<port>/health` -> `{"ok":true}` | exit 0 |
| Preview URL | `<url from sandbox_preview>` | opened by the user: yes / no |

## 2. Code to the user's GitHub

- [ ] Every file of the project, with its path (or a single archive the user unpacks), delivered in the chat.
- [ ] `.gitignore` with `node_modules`, `.env`, `.env.*`.
- [ ] `package-lock.json` included if one was generated in the sandbox (download it with `cat package-lock.json` through `sandbox_run` if needed).
- [ ] Pushed to a GitHub repository (`git init && git add . && git commit -m "first version" && git push`).

## 3. CreateOS project settings (Deploy > Import from GitHub)

| Field | Value |
|---|---|
| Branch | `main` |
| Framework | Node.js |
| Server port | `<port>` (same number as `PORT` default in `src/server.js`) |
| Project name | `<name>` (becomes the subdomain) |
| Build commands | `npm ci` (`npm install` if there is no lockfile) |
| Run commands | `npm start` |

## 4. Environment variables

| Name | Where the value comes from | Required |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard (test mode) > API keys, `sk_test_...`, or `stripe projects env --pull` | yes |
| `STRIPE_WEBHOOK_SECRET` | the webhook endpoint created in section 6, `whsec_...` | yes |
| `PUBLIC_URL` | the live URL from section 5 | yes |
| `PRICE_CENTS` | integer cents, e.g. `900` for US$ 9.00 | no (default in code) |
| `<other>` | `<stripe projects add ... output>` | `<yes/no>` |

CLI alternative: `createos env set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... PUBLIC_URL=...`

## 5. Deploy and read the URL

```
createos login
createos init
createos deploy
createos status            # shows the live URL
createos deployments build-logs   # if the build fails
createos deployments logs -f      # runtime logs
```

- [ ] `curl -fsS https://<live-url>/health` answers `{"ok":true}`.

## 6. Stripe webhook on the live URL

- [ ] Stripe Dashboard (test mode) > Developers > Webhooks > add endpoint `https://<live-url>/webhook`.
- [ ] Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
- [ ] Signing secret copied into `STRIPE_WEBHOOK_SECRET`, then `createos deployments retrigger`.
- [ ] One test payment with `4242 4242 4242 4242` (any future date, any CVC): the order turns `paid`.

## 7. Before real money

- [ ] Replace the in-memory store with a database (orders survive restarts).
- [ ] Switch to live keys only after a review; keep test and live secrets in separate CreateOS environments.
- [ ] What was **not** verified (write it plainly): `<e.g. real Checkout redirect, email delivery, load>`.
