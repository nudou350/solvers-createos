---
title: Database, transactions, pagination and idempotency
source: Express security guide (parameterized queries) and the IETF Idempotency-Key draft
source_url: https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/
source_date: 2026-10-02
valid_until: 2027-04-30
tags: [database, sql, transaction, pagination, idempotency]
---

## Parameterized queries

SQL built by concatenation or a template string with client data is injection. Always use parameters: with `pg`, `client.query("select id from users where email = $1", [email])`; with Prisma, the client methods and `$queryRaw` with a template tag (which parameterizes), and never `$queryRawUnsafe` with assembled text; with query builders, the builder's own operators. Dynamic identifiers (a column name in a sort) cannot be parameterized: accept them only from a fixed list (an `enum` in the schema).

The Express security guide sums it up: use parameterized queries against SQL injection and filter input against XSS and command injection.

## Transactions

If two or more writes must happen together (create an order and decrement stock), do it in a transaction and keep the business rule inside it. Keep the transaction short: no external HTTP call inside it, because it holds the connection and locks rows. For "read, decide and write" without a race, use a conditional `UPDATE ... WHERE` (`where stock >= $1`) and check how many rows changed, or lock the row with `SELECT ... FOR UPDATE`.

A uniqueness violation is the most reliable way to prevent duplicates: in Postgres, the error has code `23505`; in Prisma, `P2002`. Translate it to 409.

## Pagination and lists

Every list has a maximum `limit` enforced by the server (for example, 100). For small tables, `limit` and `offset` are enough; on large tables, offset gets slow and unstable with inserts, so use a cursor (keyset pagination): `where (created_at, id) < ($1, $2) order by created_at desc, id desc limit $3`. Create an index that covers the filter and the sort, and return the next page's cursor instead of an exact total (counting everything is expensive).

## Idempotency

An operation that charges or creates something must support repetition, because networks fail and clients retry. The industry standard is the `Idempotency-Key` header: the client generates a unique key per intent; the server stores the key, a digest of the body and the result in a table with a uniqueness constraint; on repeat it returns the same result, and with the same key and a different body it answers an error (409 or 422, depending on the product). Store the key in the same transaction as the operation and give it an expiry (for example, 24 hours).

The IETF document (`draft-ietf-httpapi-idempotency-key-header`, "The Idempotency-Key HTTP Header Field") was, when checked on October 2, 2026, an expired Internet-Draft (last revision on October 15, 2025), with no RFC number. Tell the user it is a widely used convention but not yet a published standard. A header-free alternative: a natural key with a uniqueness constraint in the database (one payment per order).

## Money, ids and dates

Money as integers in the smallest unit (cents) or in an exact decimal type; never `float`. Dates in UTC, in ISO 8601 format, with conversion to a time zone only at the edge. Unpredictable ids (UUID) reduce the risk of enumeration but do not replace the owner check.
