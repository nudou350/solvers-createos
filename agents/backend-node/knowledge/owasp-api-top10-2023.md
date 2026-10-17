---
title: OWASP API Security Top 10 (2023) applied to Node APIs
source: OWASP API Security Top 10 2023
source_url: https://api-security.owasp.org/editions/2023/en/0x11-t10
source_date: 2026-10-02
tags: [owasp, security, api, bola, idor]
---

## API1:2023 Broken Object Level Authorization (BOLA)

The API receives an object's id and returns or changes it without checking whether the logged-in user may touch that object. This is the classic IDOR and the number one risk on the list. OWASP's prevention, in short: have a policy-based authorization mechanism with a user hierarchy; check access in every function that uses a client-supplied id to touch a record; prefer random, unpredictable ids (GUIDs) and write tests that prove the authorization, never shipping a change that breaks those tests.

In Node, the practical rule is to put the owner in the query filter (`where: { id, ownerId }`) rather than checking after fetching. Unpredictable ids help but do not replace the check.

## API2:2023 Broken Authentication

Failures in login, password recovery, and token issuing and validation: no attempt limit, tokens without expiry, a JWT algorithm accepted without checking, a different message for "email does not exist" and "wrong password". In Node: a stricter rate limit on authentication routes, passwords with argon2id or bcrypt, short-lived JWTs verified with an explicit algorithm list, a generic response for invalid credentials, and single-use recovery tokens with a short expiry.

## API3:2023 Broken Object Property Level Authorization

Combines two older failures: exposing too many properties in the response (excessive data exposure) and accepting too many properties on input (mass assignment). In Node: a strict input schema that rejects unknown fields, a write object built field by field, and an output mapper that returns only the contract's fields. Never serialize the whole ORM object: `passwordHash`, `role` and audit fields leak that way.

## API4:2023 Unrestricted Resource Consumption

The API does not limit what the client can consume: a giant body, an unpaginated list, an upload with no cap, an expensive operation with no rate limit, an external call with no timeout. In Node: `limit` on the body parser, a maximum `limit` and cursor on lists, a per-user rate limit, a timeout on every external call (`AbortSignal.timeout`), a database pool limit, and a cap on upload size and count. Services billed by usage also need a spend alert.

## API5:2023 Broken Function Level Authorization (BFLA)

Administrative or other-role endpoints reachable by people who shouldn't reach them: `DELETE /users/:id` open to any logged-in user, or an `/admin` route that merely disappears from the menu. In Node: the role is checked on the server in middleware or a central policy, deny by default, and each HTTP method is handled separately (a protected GET does not protect the PUT on the same route). The role never comes from a field sent by the client.

## API6:2023 Unrestricted Access to Sensitive Business Flows

The abuse is not a technical flaw, it is legitimate use at scale: buying all the stock, creating thousands of accounts, abusing a coupon or referral. In Node: a per-account and per-device limit on sensitive business flows, idempotency on operations that charge, uniqueness rules in the database (one coupon per person) and anomalous-pattern detection. The endpoint contract should name the sensitive flow and the limit chosen.

## API7:2023 Server Side Request Forgery (SSRF)

The API fetches a URL supplied by the client (an avatar image, a webhook, a link preview) and the server ends up reaching internal resources: cloud metadata, the database, admin panels. In Node: accept only `https`, an allowlist of hosts, resolve the DNS and block private, loopback and link-local addresses (such as `127.0.0.1`, `10.0.0.0/8`, `169.254.0.0/16`), do not follow redirects without revalidating, and set a timeout and a cap on response size.

## API8:2023 Security Misconfiguration

Insecure defaults in production: a stack trace in the response, open CORS, missing security headers, `x-powered-by` on, weak TLS, excessive permissions, an exposed debug server. In Node: `helmet`, CORS with an explicit list of origins, `NODE_ENV=production`, an error handler that reveals no detail, environment variables validated at startup, and up-to-date images and dependencies.

## API9:2023 Improper Inventory Management

Old API versions, test environments and debug endpoints left online without the new version's protection. In Node: keep a list of the endpoints and versions in production, turn off whatever is unused, do not expose internal documentation (`/docs`, `/debug`) without authentication, and apply the same protection to every live version.

## API10:2023 Unsafe Consumption of APIs

Trusting data from third-party APIs too much: a partner's response is untrusted input. In Node: validate the external response with a schema, set a timeout and a size limit, do not follow redirects to unknown hosts, do not pass the raw response on to the client or into queries, and validate the signature of incoming webhooks.
