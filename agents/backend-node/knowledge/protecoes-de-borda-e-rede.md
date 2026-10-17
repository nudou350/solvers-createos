---
title: Edge protections: headers, CORS, rate limiting, proxy, timeouts and webhooks
source: Express production security best practices and the "Behind proxies" guide
source_url: https://expressjs.com/en/advanced/best-practice-security.html
source_date: 2026-10-02
tags: [helmet, cors, rate-limit, trust-proxy, timeout, webhook]
---

## Security headers and fingerprinting

The Express security guide recommends `helmet`, which sets headers such as CSP, HSTS, X-Frame-Options and X-Content-Type-Options, and turning off the `X-Powered-By` header (`app.disable('x-powered-by')`). Having your own 404 and error handler keeps the default page from revealing the framework. TLS lives at the proxy (nginx, the cloud load balancer) and the API speaks HTTP only on the internal network. Redirects to URLs that come from the client require validating the destination host (open redirect).

## CORS

CORS is a browser rule, not a server protection: it does not stop a non-browser client from calling the API. Configure an explicit list of allowed origins and compare the received origin with the list. Browsers reject `Access-Control-Allow-Origin: *` on requests with credentials (cookies), so `origin: "*"` together with `credentials: true` does not work and is a sign of misconfiguration. Reflecting any received `Origin` back in the header is equivalent to allowing everyone with credentials and is worse. If the API is only consumed by the product's own server, turn CORS off.

## Rate limiting and trust proxy

Limit per authenticated user and, before login, per IP; stricter on login and password recovery. When the API sits behind a proxy, `req.ip` shows the proxy's IP until you configure `trust proxy`: without it, all users share the same quota. The setting accepts a number of hops (`1` trusts one proxy), subnets and a function. The Express guide warns about two risks: with `true`, the last trusted proxy must overwrite `X-Forwarded-For`, `X-Forwarded-Host` and `X-Forwarded-Proto`, otherwise the client forges its IP; with a hop count, there cannot be paths of different lengths to the application. Answer 429 with `Retry-After`.

An in-process memory quota does not work with more than one instance: use shared storage (Redis or the database).

## Timeouts and size

Every external call has a deadline: `fetch(url, { signal: AbortSignal.timeout(5000) })`. The body has a cap (`express.json({ limit: "100kb" })`; the parser's default is already 100kb), lists have a maximum `limit`, uploads have a maximum size, a file count limit, and a type checked by content rather than by extension. On the database, limit the connection pool and set a query deadline, so a slow query does not exhaust the connections and take the API down.

## Receiving webhooks securely

Verify the provider's signature before trusting the body: compute the HMAC of the raw body (`express.raw()` on the webhook route, before any `express.json()`), compare it with `crypto.timingSafeEqual`, and check the timestamp to reject old replays. Treat the event as idempotent: the provider resends, so store the event id with a uniqueness constraint and ignore the duplicate. Answer 2xx quickly and process in the background. Check the final state in the provider's API when the event moves money.

## Calling third-party URLs (SSRF)

When the server fetches a URL that came from the client, accept only `https`, validate the host against an allowlist, resolve the DNS and block private, loopback and link-local addresses, do not follow redirects without revalidating, and limit the response time and size. Validating only the URL text is not enough, because a domain name can point to an internal IP.
