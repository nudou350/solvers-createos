import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { env } from "./env.js";
import { authRouter, sessionUserHandler } from "./auth/magic-link.js";
import { optionalUser, requireUser } from "./auth/middleware.js";
import { storeRouter } from "./store/routes.js";
import { checkoutRouter, stripeWebhookHandler } from "./payments/stripe-routes.js";
import { errorHandler } from "./lib/http.js";
import { pool } from "./db/index.js";
import { submissionUploadHandlers } from "./submissions/upload.js";

/** Extra routes registered by other modules (MCP, OAuth, ...) before the error handler. */
export type Mount = (app: Express) => void;

/**
 * The Express app. `mounts` add the module routers (src/modules.ts); route tests call `createApp([])` and sign a session
 * with `signSession(userId)`.
 */
export function createApp(mounts: Mount[] = []): Express {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.get("/health", async (_req, res) => {
    try {
      await pool.query("select 1");
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  const origins = new Set([env.PUBLIC_WEB_URL.replace(/\/$/, "")]);
  if (env.NODE_ENV !== "production") {
    // Dev web app (3041) and the usual local tooling ports.
    origins.add("http://localhost:3041");
    origins.add("http://localhost:3000");
    origins.add("http://localhost:5173");
  }
  const webCors = cors({
    origin: (origin, cb) => cb(null, !origin || origins.has(origin)),
    credentials: true,
  });

  // Always per IP; per user on top.
  const byIp = rateLimit({
    windowMs: 60_000,
    limit: env.RATE_LIMIT_PER_MINUTE * 3,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a moment and try again.", code: "rate_limited" },
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? "0.0.0.0"),
  });
  const byUser = rateLimit({
    windowMs: 60_000,
    limit: env.RATE_LIMIT_PER_MINUTE * 2,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a moment and try again.", code: "rate_limited" },
    skip: (req) => !req.userId,
    keyGenerator: (req) => req.userId ?? "anon",
  });
  // Costly routes (CPU embeddings, Stripe API calls).
  const costly = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a moment and try again.", code: "rate_limited" },
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? "0.0.0.0"),
  });

  // Stripe signs the exact bytes it sent: the webhook reads the raw body, so it is mounted BEFORE express.json.
  app.post("/api/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }), stripeWebhookHandler);

  // Package ZIP upload (raw body up to SUBMISSION_MAX_ZIP_BYTES, streamed to disk): BEFORE express.json, with login and
  // profile checked before the body is read (submissions/upload.ts; PACKAGE_SPEC.md 14.4).
  app.post("/api/creator/submissions", webCors, byIp, ...submissionUploadHandlers);

  app.use("/api", webCors, express.json({ limit: "256kb" }), cookieParser(), byIp, optionalUser, byUser);
  app.use("/api/search", costly);
  app.use("/api/checkout", (req, res, next) => (req.method === "POST" ? costly(req, res, next) : next()));
  app.use("/api/auth", authRouter);
  app.get("/api/me", requireUser, sessionUserHandler);
  app.use("/api", storeRouter);
  app.use("/api", checkoutRouter);

  for (const mount of mounts) mount(app);

  app.use((_req, res) => {
    res.status(404).json({ error: "Route not found", code: "not_found" });
  });
  app.use(errorHandler);
  return app;
}
