# @solvers/web

Solvers storefront in Next.js 16 (App Router, React 19, plain CSS from the design). Talks to the API in `apps/server`
on the same origin (`/api/...`). Read `AGENTS.md` before writing Next code (the installed Next differs from older docs).

## Run

```bash
# 1. API on 3038 (another terminal): apps/server, `pnpm dev`
# 2. Web in dev on 3041 (next.config rewrites /api, /mcp, /oauth, /preview, /.well-known and /health to the API)
pnpm --filter @solvers/web dev

# Production. In production nginx serves /api on the same domain.
pnpm --filter @solvers/web build
PORT=3041 API_INTERNAL_URL=http://127.0.0.1:3038 node apps/web/start.mjs
```

Checks: `pnpm --filter @solvers/web typecheck` (`next typegen && tsc --noEmit`) and `pnpm --filter @solvers/web test`
(`check-messages.mjs` + `node:test` unit tests in `test/`).

## Environment

`NEXT_PUBLIC_*` values are inlined at build time: rebuild after changing them. Template: `.env.example` (copy to
`.env.local`, never committed).

| Variable | When | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | build | API origin for the browser. Empty (default) = same origin. |
| `API_INTERNAL_URL` | runtime | API URL for server components (catalog). Default `http://127.0.0.1:3038`. |
| `API_DEV_URL` | dev | Target of the `next dev` rewrites. Default `http://localhost:3038`. |
| `PORT` / `HOSTNAME` | runtime | Used by `start.mjs`. Default `3041` / `127.0.0.1`. |

## Sign-in and payments

- `src/lib/session.tsx` (`SessionProvider`, `useSession()`): the session lives in the httpOnly `solvers_session`
  cookie and is read from `GET /api/auth/me`. `/login` asks for an email (`POST /api/auth/email`); the link in the
  email opens the session and the person returns to the page they came from. With `DEV_LOGIN=1` on the API, the link
  comes back in the response and `/login` shows it as a "Continue" button.
- `src/components/checkout/glue.ts` (`useStripeCheckout(slug)`): "Buy with Stripe" calls `POST /api/checkout
  { agentSlug }` and sends the browser to the Stripe Checkout page. 401 goes to `/login` and back to
  `/solvers/<slug>?buy=1` (which resumes the purchase); 409 (already owned) goes to the library. Stripe returns to
  `/library?bought=<slug>`, which waits for the webhook and shows the success banner. Prices are integer USD cents.
- `src/lib/error-text.ts` turns API error codes into text in the page language; `src/lib/config.ts`:
  `usePublicConfig()`.

## Routes

| Route | Screen |
|---|---|
| `/` | Home: search by need, categories, top rated, trending, new |
| `/solvers/[slug]` | Solver page (`?buy=1` opens the checkout) |
| `/creators/[id]` | Creator profile |
| `/checkout?agent=<slug>` | Checkout summary with "Buy with Stripe" |
| `/login?next=<path>` | Email sign-in link |
| `/install?agent=<slug>` | Connector install guide |
| `/connect?req=...` | Connector consent (destination of the server's `/oauth/authorize`) |
| `/library`, `/library/memories` | Owned Solvers (`?bought=<slug>` banner), usage and memories |
| `/profile` | Profile and reputation |
| `/creator`, `/creator/publish`, `/creator/submissions/[id]` | Creator area |
| `/admin/reviews` | Review queue (admin accounts) |
