---
title: Structured logs without sensitive data, metrics and graceful shutdown
source: pino documentation (redaction); the creator's operations practices
source_url: https://github.com/pinojs/pino/blob/main/docs/redaction.md
source_date: 2026-10-02
tags: [logs, pino, observability, shutdown]
---

## Structured logging and the request identifier

Log in JSON, one event per line, with level, message and fixed fields: request identifier (generated on entry or read from a trusted header), method, route (the pattern, `/orders/:id`, not the full URL), status, duration in milliseconds and user identifier (not the email). Propagate the identifier to external calls and into the 5xx error body, so support can find the right line.

Levels: `info` for business events, `warn` for a recoverable situation (rate limit reached), `error` for an unexpected failure, always with the cause.

## What never to log

Password, token, cookie, `Authorization` header, card number, national ID number (such as Brazil's CPF), full email and address, the whole login or payment body. A log with personal data becomes a second database without the first one's protections. `pino` has the `redact` option with paths (including wildcards, which cost more performance than fixed paths) to mask (`censor`) or remove (`remove: true`) fields before writing, for example `redact: { paths: ["req.headers.authorization", "req.headers.cookie", "*.password"], censor: "[REDACTED]" }`. Check the documentation for the installed version and test it: write a test that logs an object with `password` and asserts that the output does not contain the value.

## Metrics worth having

Latency per route in percentiles (p50, p95, p99), error rate per route and per code, requests per second, database pool connection usage, task queue size and event loop lag. Measure p95 per route before optimizing or adding a cache: optimization without measurement swaps one problem for another.

## Graceful shutdown

On `SIGTERM` (deploy, scaling), stop accepting new connections (`server.close()`), wait for in-flight requests to finish within a maximum deadline, close the database pool and exit. Also set a deadline to force the exit. On `unhandledRejection` and `uncaughtException`, log the error with context and end the process so the manager (PM2, Docker, Kubernetes) starts a clean one; carrying on as if nothing happened leaves the process in an unknown state.

## Service health

Expose a simple health check route (`/healthz`) that does not touch the database, and a readiness one (`/readyz`) that checks critical dependencies; both with no sensitive data and no authentication, but kept out of the public documentation and behind the proxy if possible.
