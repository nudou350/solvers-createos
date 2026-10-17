# Endpoint skeleton: Express 5 + zod 4 + problem+json

Base for the `PATCH /orders/:id` example (update the delivery address). Adapt names, data access and the project's authentication. In Express 4, wrap async handlers (`wrap(fn)`), because a promise rejection does not reach the error handler on its own. In zod 3, replace `z.strictObject({...})` with `z.object({...}).strict()` and `z.uuid()` with `z.string().uuid()`.

## errors.ts

```ts
export class AppError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail?: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(title);
  }
}
export const notFound = () => new AppError(404, "Resource not found");
export const conflict = (detail: string) => new AppError(409, "State conflict", detail);
export const invalid = (errors: { path: string; message: string }[]) =>
  new AppError(422, "Invalid body", "One or more fields failed validation.", { errors });
```

## validate.ts

```ts
import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { invalid } from "./errors";

type Parts = { params?: ZodType; query?: ZodType; body?: ZodType };

// Validates before any side effect. Never echoes the submitted value (it may be sensitive).
// In Express 5, req.query is read-only: the result goes into res.locals.input.
export const validate =
  (parts: Parts): RequestHandler =>
  (req, res, next) => {
    const out: Record<string, unknown> = {};
    for (const key of ["params", "query", "body"] as const) {
      const schema = parts[key];
      if (!schema) continue;
      const r = schema.safeParse(req[key]);
      if (!r.success) {
        return next(invalid(r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))));
      }
      out[key] = r.data;
    }
    res.locals.input = out;
    next();
  };
```

## orders-route.ts

```ts
import { Router } from "express";
import { z } from "zod";
import { conflict, notFound } from "./errors";
import { validate } from "./validate";

export const orders = Router();

const params = z.strictObject({ id: z.uuid() });
const body = z.strictObject({ address: z.string().trim().min(5).max(200) }); // only what the contract allows

// Output mapper: only the contract fields, never the ORM object.
const toDto = (o: { id: string; status: string; address: string; updatedAt: Date }) => ({
  id: o.id,
  status: o.status,
  address: o.address,
  updatedAt: o.updatedAt.toISOString(),
});

orders.patch("/orders/:id", validate({ params, body }), async (req, res) => {
  const { params: p, body: b } = res.locals.input as { params: z.infer<typeof params>; body: z.infer<typeof body> };
  const userId = req.user!.id; // comes from the session or an ALREADY verified token, never from the body

  // Authorization in the query: the owner goes into the filter.
  const order = await db.orders.findFirst({ where: { id: p.id, ownerId: userId } });
  if (!order) throw notFound(); // 404 for another owner's order too
  if (order.status !== "open") throw conflict("This order no longer accepts address changes.");

  // Field-by-field write (never update(req.body)).
  const updated = await db.orders.update({ where: { id: order.id }, data: { address: b.address } });
  res.json(toDto(updated));
});
```

## app.ts

```ts
import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { AppError } from "./errors";
import { orders } from "./orders-route";

export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // number of real proxies in front of the API; adjust to your environment
app.use(helmet());
app.use((req, res, next) => {
  res.setHeader("x-request-id", (req.id = randomUUID()));
  next();
});
app.use(express.json({ limit: "100kb" }));
// app.use(authentication);  // sets req.user or answers 401 with problem+json
// app.use(rateLimiter);     // per user and per IP, with shared storage
app.use(orders);

app.use((req, res) => res.status(404).type("application/problem+json").json({ title: "Route not found", status: 404 }));

// Single error handler: registered last, with 4 parameters.
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  if (err instanceof AppError) {
    return res.status(err.status).type("application/problem+json").json({ title: err.title, status: err.status, detail: err.detail, ...err.extra });
  }
  // Body parser errors (broken JSON = 400, large body = 413) carry their own 4xx status.
  const status = (err as { status?: number }).status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return res.status(status).type("application/problem+json").json({ title: status === 413 ? "Body too large" : "Invalid request", status });
  }
  console.error({ requestId: req.id, err }); // replace with the project's logger, with sensitive-field redaction
  res.status(500).type("application/problem+json").json({ title: "Internal error", status: 500, instance: req.id });
});
```

The validation, authorization and error-handling part was run with Express 5.2.1 and zod 4 (without `helmet` or a database): an invalid id, an extra field and a too-short text answer 422; another owner's order answers 404; broken JSON answers 400. zod's messages come out in English: write the ones the end user sees in your own language with the field's `error` parameter.

Things to check after adapting: authentication and rate limiting wired in before the routes; `req.user` and `req.id` declared in the Express types; `db` is the project's data access; different-owner and extra-field tests written (`matriz-de-testes` template).
