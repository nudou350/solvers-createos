---
title: Authentication, passwords, JWT, sessions and authorization
source: OWASP Password Storage Cheat Sheet, RFC 8725 (JWT BCP), Express production security best practices
source_url: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
source_date: 2026-10-02
valid_until: 2027-04-30
tags: [authentication, password, jwt, session, argon2, authorization]
---

## Storing passwords

OWASP recommendation: Argon2id with at least 19 MiB of memory, 2 iterations and parallelism 1 (`m=19456, t=2, p=1`). If Argon2id is not available, scrypt with N=2^17 (128 MiB), r=8, p=1; bcrypt with a work factor of 10 or more (note: bcrypt only uses the first 72 bytes of the input); PBKDF2 with HMAC-SHA-256 and 600,000 iterations only when FIPS-140 compliance is required.

In Node: the `argon2` package covers Argon2id. Native `crypto.scrypt` works without a native dependency, but with N=2^17 you must raise the `maxmem` option, because the default limit is lower than the memory required. Never use a plain hash (SHA-256, MD5) for passwords, and compare hashes or tokens with `crypto.timingSafeEqual`.

## Login without leaking information

Return the same message and the same code for "email does not exist" and "wrong password" (for example, 401 with "invalid credentials"), otherwise the API lets people discover which accounts exist. Do the hashing work even when the user does not exist, so response time does not give it away. Express recommends limiting login attempts by counting failures per user plus IP and per IP over time (for example, with `rate-limiter-flexible`). Password recovery gets the same care: an identical response whether or not the account exists, a single-use token and a short expiry.

## JWT: what to check (RFC 8725)

Current JWT best practice says: the library must receive the list of accepted algorithms from the caller and use no other (section 3.1); all cryptographic operations must be validated and the whole token rejected if any of them fails (3.3); symmetric keys need enough entropy, with no memorable password for HS256 (3.5); confirm issuer and subject (3.8); validate `aud` when there is more than one recipient (3.9); and use the type (`typ`) so tokens for different purposes are not confused (3.11).

In practice: `jwt.verify(token, key, { algorithms: ["RS256"], issuer, audience })` with the fixed list, short expiry (for example, 15 minutes) and a rotating refresh token stored on the server. A JWT cannot be revoked on its own before it expires: if the product needs immediate logout, use a server-side session or a revocation list.

## Cookie sessions

Express recommends a generic cookie name (not the default `connect.sid`) and security options on every cookie: `secure: true` (HTTPS only), `httpOnly: true` (inaccessible to the page's JavaScript) and restrictions on `domain`, `path` and expiry; add `sameSite` to limit sending across sites. With a session cookie, the API is exposed to CSRF: use `SameSite` and an anti-CSRF token on routes that change data. A token sent in the `Authorization` header is not sent automatically by the browser and therefore does not suffer CSRF, but it is exposed to XSS if stored in `localStorage`.

## Authorization: central policy and deny by default

Authorization is a server decision, made in every function that touches a resource: object (the owner) and function (the role). Centralize the rule in a function or policy (`canEdit(user, order)`) instead of scattering `if`s through the handlers; deny by default and allow explicitly. The role comes from the session or the verified token, never from a field sent by the client. For another owner's resource, answer 404 if revealing its existence is a risk; use 403 only when the resource is public in the sense that its existence is known. Every new endpoint gets a test with a second user.
