---
title: API tests in Node: runner, strategy and what to always cover
source: Node.js documentation (test runner) and Vitest 5 engines requirements
source_url: https://registry.npmjs.org/vitest/latest
source_date: 2026-10-02
valid_until: 2027-01-31
tags: [tests, vitest, node-test, supertest, api]
---

## Choosing the runner

Node ships a native runner (`node --test`, the `node:test` module) that needs no dependency and runs on the LTS version. Vitest 5 (the version checked on October 2, 2026) requires Node `^22.12.0 || ^24.0.0 || >=26.0.0`; Jest remains common in older projects. Use the runner the project already has. In a new TypeScript project, Vitest or `node:test` with `tsx` are good choices.

## Test through the HTTP edge

Start the app on an ephemeral port and call it with `fetch`:

```ts
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const res = await fetch(`${base}/orders/${id}`, { headers: { authorization: `Bearer ${tokenB}` } });
assert.equal(res.status, 404); // user B cannot see user A's order
assert.match(res.headers.get("content-type") ?? "", /problem\+json/);
```

`supertest` does the same without opening a port manually (`request(app).get(...)`). What matters is going through the parser, the middlewares and the error handler, and not calling the handler directly.

## Minimum matrix per endpoint

Happy path with the exact output from the contract; 401 with no credential and with an expired one; another owner's resource (404 or 403 per the contract) with a real second user; 422 for an invalid body, an unknown field and a size limit; a mass assignment attempt (send `role` or `ownerId` and prove it did not change, by looking at the database); 409 for an invalid state and for a repeat; 429 after the limit; an external service failure with the expected response and no leaked detail.

Each security test must fail when the rule is removed: take `ownerId` out of the filter and watch the owner test break. A test that has never failed proves nothing.

## Data and isolation

Each test creates its own data and removes it (or runs in a rolled-back transaction). Avoid implicit execution order and shared data. For the database, prefer a real disposable instance (a container) over mocking data access: a mock won't catch query, uniqueness or transaction errors. External calls are replaced at the edge (a local fake server or injection of the HTTP client), with a timeout case.

## Clock, randomness and waiting

Use a fake clock to expire tokens and rate limit windows without really waiting, and inject id and time generators when the result depends on them. Avoid `setTimeout` to wait for effects: await the promise or the event.
