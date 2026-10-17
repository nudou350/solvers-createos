# Step 3: Business rules, errors and protections

## Goal

Implement the business rule with explicit states, errors standardized in a single place, and the protections that keep the API up: timeouts, transaction, idempotency and rate limiting. What step 2 made safe now gets predictable behavior under failure, repetition and abuse.

## What to ask the user

Ask only what the contract did not settle:

- Which states does the resource have and which transitions are allowed (e.g., a shipped order no longer accepts an address change)?
- Does the operation charge, create an order or fire an email? If so, can the client repeat the call by accident (double click, network retry)?
- Does the endpoint call external services? What is the maximum acceptable time?
- Is there already an agreed usage limit per user (per minute, per day)?

## How to run

1. **Check the knowledge base** (`search_knowledge`): "problem+json", "idempotency", "rate limit", "timeout". Cite source and date.
2. **Model the states.** Write the table state → allowed transitions. An invalid transition is a conflict (409), not a validation error.
3. **Typed errors and one error middleware.** Routes throw `NotFoundError`, `ConflictError`, `ForbiddenError`, etc.; a single handler at the end converts them into `application/problem+json` (RFC 9457) with `type`, `title`, `status` and `detail`. In Express 4, wrap async handlers; in Express 5 the rejection already reaches the handler. An unexpected error answers a generic 500, with the detail only in the log. Never return a stack trace or the database's `error.message`.
4. **Transaction** when more than one write must be atomic. Treat a database uniqueness violation as 409 (Postgres: code `23505`; Prisma: `P2002`).
5. **Idempotency** for any operation that charges or creates something: accept `Idempotency-Key`, store the key with the result under a uniqueness constraint, and return the same response on repeat. Tell the user that the header is still an IETF draft, not an RFC; it is an industry convention.
6. **Timeout on every external call** with `AbortSignal.timeout(ms)` and handling of the timeout error (504 or 502, depending on the case). Also set the database pool limit and the body size limit (`express.json({ limit })`).
7. **Rate limit** per user or IP, stricter on login and password recovery. Behind a proxy, set `trust proxy` with the correct number of hops, otherwise everyone becomes the same IP. Answer 429 with `Retry-After`.
8. **Capped lists.** Pagination with a maximum `limit` (e.g., 100) and, on large tables, a cursor instead of offset; an index on the filter and sort columns.
9. **Show the complete code** of the changed files and list the implemented responses (code and when it occurs).

## Common mistakes

- A `try/catch` that swallows the error and answers 200.
- Treating a state conflict as 400 or 500.
- Idempotency only in process memory: it vanishes on deploy and does not work with more than one instance.
- A timeout only on the HTTP client and none on the database or the queue.
- `trust proxy: true` without the proxy overwriting `X-Forwarded-For`: the client forges its IP and escapes the limit.
- Offering pagination and leaving `limit` unbounded.
- Returning the driver's error to the client ("duplicate key value violates...").

## result_summary format

```
states: <state -> transitions>
errors: <types and codes; problem+json format: yes|no>
transaction: <where>; idempotency: <key and storage | not applicable>
timeouts: <call -> ms>; pool/body: <limits>
rate_limit: <rule; trust proxy: <value>>
pagination: <max limit; cursor|offset>
responses: <list of implemented codes>
files: <paths>
```
