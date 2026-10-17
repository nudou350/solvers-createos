---
title: Standardized errors (RFC 9457) and choosing the HTTP status code
source: RFC 9457 (Problem Details for HTTP APIs) and RFC 9110 (HTTP Semantics)
source_url: https://www.rfc-editor.org/rfc/rfc9457.html
source_date: 2026-10-02
tags: [errors, problem-json, rfc9457, http, status]
---

## The application/problem+json format

RFC 9457 (July 2023) replaces RFC 7807 and defines the `application/problem+json` media type (and `application/problem+xml`). The five standard members: `type` (a URI that identifies the problem type; if absent, `about:blank` applies), `status` (the HTTP status code, informational only for the consumer), `title` (a short, human-readable summary of the type), `detail` (an explanation of this occurrence) and `instance` (a URI for this occurrence). Extra problem-specific members are allowed, which is handy for listing the invalid fields.

```json
{
  "type": "https://api.example.com/problems/validation",
  "title": "Invalid body",
  "status": 422,
  "detail": "One or more fields failed validation.",
  "errors": [{ "path": "address", "message": "Minimum of 5 characters" }]
}
```

`detail` and the extra fields never carry a stack trace, raw database error text, or the sensitive value that was sent.

## Which code to use

400 Bad Request: malformed request (broken JSON). 401 Unauthorized: no credential, or an invalid or expired one. 403 Forbidden: authenticated, but without permission for the function. 404 Not Found: nonexistent resource, or another owner's when revealing its existence is a risk. 409 Conflict: the request conflicts with the current state (order already shipped, uniqueness violated, idempotency key reused with a different body). 413: body too large. 415: unsupported content type.

422 Unprocessable Content (the name in RFC 9110): the body is well formed but fails validation. 429 Too Many Requests: rate limit, with `Retry-After`. 500: unexpected failure, always generic. 502 and 504: failure or delay of an external service.

Choose one criterion and use it across the whole product: for example, 400 only for malformed JSON and 422 for any schema failure.

## A single error handler

Routes throw typed errors; a single middleware (in Express, the function with four parameters `(err, req, res, next)`, registered last) converts everything into the format above. In Express 4, async handlers need a wrapper to forward the rejection; in Express 5 the rejection already reaches the handler. If the response has already started being sent (`res.headersSent`), delegate with `next(err)`.

```ts
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const p = toProblem(err); // AppError -> status/title/detail; anything else -> generic 500
  if (p.status >= 500) req.log.error({ err }, "unexpected error");
  res.status(p.status).type("application/problem+json").json(p);
});
```

## Errors that must not leak

A driver message ("duplicate key value violates unique constraint users_email_key") reveals the schema and confirms that data exists: translate it into a 409 with your own text. An authentication error is always generic. On a 5xx, the body only says there was a failure and carries a request identifier so support can find it in the log.
