---
title: Input validation, mass assignment and output mapping
source: Zod 4 (changelog), OWASP Mass Assignment Cheat Sheet
source_url: https://zod.dev/v4/changelog
source_date: 2026-10-02
valid_until: 2027-01-31
tags: [zod, validation, mass-assignment, express]
---

## Zod 4: what changes from 3

The `zod` package version checked on October 2, 2026 is 4.6.5. According to the official v4 changelog: a strict object is now `z.strictObject({...})` (in place of `.strict()`), `z.looseObject()` replaces `.passthrough()`; string validators became top-level functions (`z.email()`, `z.uuid()`, `z.url()` instead of `z.string().email()`); custom messages use the single `error` parameter (`message`, `invalid_type_error` and `required_error` are gone); the input type of every `z.coerce` is `unknown`; the error's `.flatten()` and `.format()` methods were replaced by `z.treeifyError()`, and the problems live in `.issues`.

If the user's project is on zod 3, write in the zod 3 syntax (`.strict()`, `z.string().email()`) and warn that migrating involves these differences.

## Separate schemas for params, query and body

Each part of the request has its own schema. The body is strict: an unknown field raises an error instead of being ignored, which prevents mass assignment and the false "saved". Limits are always explicit: `max` on strings and arrays, `min` and `max` on numbers, `enum` for closed values.

```ts
const params = z.strictObject({ id: z.uuid() });
const query = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(200).optional(),
});
const body = z.strictObject({ address: z.string().trim().min(5).max(200) });
```

Query and params arrive as strings: convert explicitly. Beware of `z.coerce.boolean()`: any non-empty text, including `"false"`, becomes `true`; for flags use `z.enum(["true","false"])` and compare.

## Validation middleware without leaking data

Validate before any side effect and answer with the path and message of each invalid field, without returning the submitted value (it may be sensitive). In Express 5, `req.query` is read-only: store the validated result in `res.locals` or in your own property.

```ts
export const validate = (s: { params?: ZodType; query?: ZodType; body?: ZodType }) =>
  (req, res, next) => {
    const out: Record<string, unknown> = {};
    for (const k of ["params", "query", "body"] as const) {
      const r = s[k]?.safeParse(req[k]);
      if (r && !r.success) {
        return next(new ValidationError(r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))));
      }
      if (r) out[k] = r.data;
    }
    res.locals.input = out;
    next();
  };
```

## Mass assignment

It happens when the framework binds request parameters directly to an object's properties, and the attacker sends fields the developer did not mean to expose (such as `isAdmin`). OWASP recommends an allowlist (only the named fields) and data transfer objects (DTOs) that contain only the editable fields, and considers a blocklist riskier, because a new sensitive field may be forgotten and never added to it.

In Node, this becomes: never `update(req.body)`; build the write object field by field from the validated result (`{ address: input.body.address }`), and keep owner, role, status and price out of the write schema.

## Output mapper

The response is built by a function that picks the contract's fields, never from the ORM object. This protects against leaking `passwordHash`, internal ids and audit fields, and against a new table column becoming public without anyone deciding it. Monetary values go out as integers in cents (or as a decimal string), never as `float`.

```ts
const toOrderDto = (o: OrderRow) => ({
  id: o.id,
  status: o.status,
  address: o.address,
  totalCents: o.totalCents,
  updatedAt: o.updatedAt.toISOString(),
});
```
