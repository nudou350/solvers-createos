---
title: Node.js, Express and Fastify: versions and changes that affect the API
source: Node.js (release lines), Express 5 (migration guide) and the npm registry
source_url: https://nodejs.org/en/about/previous-releases
source_date: 2026-10-02
valid_until: 2027-01-31
tags: [node, express, fastify, versions, lts]
---

## Which Node version to use (checked on October 2, 2026)

According to the official releases page: line 26 is Current (released on May 5, 2026, latest 26.10.0); 24 (Krypton) is in LTS (latest 24.21.0) and is the one recommended for production; 22 (Jod) is in maintenance (latest 22.23.3); lines 20, 21, 23 and 25 have ended (EOL). Node recommends using only Active or Maintenance LTS versions in production. Starting with 27, the release cycle becomes annual and every major becomes LTS. This information expires: check the source's date and, if it has passed, warn that it may be out of date.

Rule for the answer: with no user preference, propose Node 24 LTS; if they are on 22, it is supported, but plan the switch; if they are on 20 or earlier, it is out of support and receives no security fixes.

## Express 5: what changed from 4

The `express` package on the npm registry is at 5.2.1 (checked on October 2, 2026) and requires Node 18 or higher. Changes that break Express 4 code, according to the official migration guide: promise rejections in async handlers and middlewares reach the error handler on their own; `req.body` is `undefined` (not `{}`) when no parser has read the body; `req.query` is read-only; wildcard `req.params` is an array.

Route syntax also changed (a wildcard needs a name: `/*splat`; the optional `?` is gone: use `/:file{.:ext}`), as did the response signatures (`res.status(201).json(obj)` instead of `res.json(obj, 201)`), the removal of `app.del()` and `req.param()`, and the default of `express.urlencoded()` (`extended: false`). The guide also points to an official codemod that automates part of the migration.

## Fastify

`fastify` package version on October 2, 2026: 5.12.5. Fastify validates input and output through a JSON Schema declared on the route (native validation with Ajv), and has plugin encapsulation and lifecycle hooks. In a Fastify project, prefer the route's own schema or a type provider for zod, instead of duplicating the validation.

Error standard: the central handler is `setErrorHandler`; you build the `application/problem+json` format in it. Body limit: the server's `bodyLimit` option.

## TypeScript directly in Node

Node runs `.ts` files with type stripping by default since 22.18.0 and 23.6.0. Limits: there is no type checking, `tsconfig.json` is ignored (path aliases don't work), imports need the `.ts` extension, type-only imports require `import type`, and features that generate code (`enum`, `namespace` with code, constructor parameter properties) are not supported in the default mode. Node refuses `.ts` files inside `node_modules`. For everything else, use `tsx` in development and compile with `tsc` for production.

In all current versions: global `fetch`, `AbortSignal.timeout()`, the `node --test` test runner and `node --env-file=.env` (no longer experimental since 22.21.0 and 24.10.0; environment variables take precedence over those in the file).

## Unhandled promise rejections

In current Node, the default mode for an unhandled rejection is `throw`: it becomes an uncaught exception and takes the process down (the `--unhandled-rejections` flag). That is why `UnhandledPromiseRejection` in production usually means "the process crashed". The fix is to handle the error at its source (an async wrapper in Express 4; Express 5 already forwards it to the handler), and to use `process.on('unhandledRejection')` only to log and shut down in a controlled way, never to carry on as if nothing happened.
