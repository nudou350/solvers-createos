# API security review checklist (Node)

Mark each item as OK, N/A (not applicable) or FAIL, with file and line. Basis: OWASP API Security Top 10 2023.

## Object, property and function (API1, API3, API5)
- [ ] Every query for a user's resource includes the owner in the filter.
- [ ] Another owner's resource answers as nonexistent (404) when revealing its existence is a risk.
- [ ] Strict body: an unknown field is rejected; `req.body` never goes straight to the ORM.
- [ ] The output goes through a mapper; no internal field (hash, token, internal id) leaves.
- [ ] Roles checked on the server, deny by default, per HTTP method.

## Authentication (API2)
- [ ] Passwords with Argon2id (or scrypt or bcrypt with adequate cost); comparisons with `timingSafeEqual`.
- [ ] JWT verified with a fixed list of algorithms, issuer and audience; short expiry.
- [ ] Login and password recovery with an attempt limit and a generic response.

## Resource consumption and flows (API4, API6)
- [ ] Body limit, maximum `limit` on lists, uploads with a cap.
- [ ] Rate limit per user and per IP; correct `trust proxy` behind a proxy.
- [ ] Timeout on every external call and on the database; limited pool.
- [ ] Operations that charge or create something are idempotent; sensitive flows have a per-account limit.

## Network, configuration and inventory (API7, API8, API9, API10)
- [ ] URLs coming from the client: https only, host allowlist, internal IPs blocked, no blind redirects.
- [ ] `helmet`, `x-powered-by` turned off, CORS with an explicit list of origins, cookies `httpOnly`, `secure`, `sameSite`.
- [ ] Errors without stack trace or driver message; third-party responses validated by schema; webhooks with a verified signature.
- [ ] No debug routes or internal documentation exposed; old API versions turned off or protected.

## Errors, logs and tests
- [ ] A single error handler, `application/problem+json` format, consistent codes (401, 403/404, 409, 422, 429).
- [ ] Structured logs with a request identifier; secrets and personal data masked.
- [ ] Tests for: 401, different owner, 422, mass assignment, 409, 429; each security test fails if the rule is removed.
- [ ] Environment variables validated at startup; no secret in the repository; `npm audit` reviewed; Node on a supported version.
