import { Router, type Response } from "express";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { env } from "../env.js";
import { randomToken } from "../lib/crypto.js";
import { h, HttpError, parse } from "../lib/http.js";
import { SESSION_COOKIE, SESSION_TTL_SECS, signSession } from "./jwt.js";
import { hashLoginToken, LOGIN_TOKEN_TTL_MS, magicLinkUrl, safeNextPath, webUrlFor } from "./magic-link-rules.js";
import { requireUser, requireUserId } from "./middleware.js";
import { normalizeEmail } from "./person.js";

// Web sign-in by e-mail magic link (mounted at /api/auth):
//   POST /api/auth/email { email, next? } → { ok, devLink? }   creates the user if missing and e-mails a single-use link
//                                                              (15 min). With DEV_LOGIN=1 the link is logged and returned.
//   GET  /api/auth/verify?token=&next=    → 302 to PUBLIC_WEB_URL + next, with the httpOnly `solvers_session` cookie
//                                           (an invalid or used link goes to /login?error=invalid_link)
//   POST /api/auth/logout                 → { ok }
//   GET  /api/auth/me (also GET /api/me)  → SessionUser { userId, email, emailVerified }, 401 when signed out

export const authRouter = Router();

const WINDOW_MS = 15 * 60_000;
const tooMany = { error: "Too many login e-mails. Please wait a few minutes and try again.", code: "rate_limited" };

const emailByIp = rateLimit({
  windowMs: WINDOW_MS,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "0.0.0.0"),
  message: tooMany,
});
const emailByAddress = rateLimit({
  windowMs: WINDOW_MS,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => {
    const raw = (req.body as { email?: unknown } | undefined)?.email;
    return (typeof raw === "string" && normalizeEmail(raw)) || "invalid";
  },
  validate: { keyGeneratorIpFallback: false },
  message: tooMany,
});

/** Finds or creates the user of a canonical e-mail (one statement, safe under concurrency). */
export async function upsertUserByEmail(email: string) {
  const [user] = await db
    .insert(schema.users)
    .values({ email })
    .onConflictDoUpdate({ target: schema.users.email, set: { email: sql`excluded.email` } })
    .returning();
  return user!;
}

async function sendLoginEmail(to: string, link: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject: "Your Solvers sign-in link",
      text: `Click to sign in to Solvers (valid for 15 minutes):\n\n${link}\n\nIf you did not ask for this, ignore this e-mail.`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`e-mail provider answered ${res.status}`);
}

authRouter.post(
  "/email",
  emailByIp,
  emailByAddress,
  h(async (req) => {
    const body = parse(z.object({ email: z.string().max(320), next: z.string().max(2000).optional() }), req.body);
    const email = normalizeEmail(body.email);
    if (!email) throw new HttpError(400, "Enter a valid e-mail address", "validation");
    if (!env.DEV_LOGIN && !env.RESEND_API_KEY) throw new HttpError(503, "E-mail login is not configured on this server", "unavailable");

    const user = await upsertUserByEmail(email);
    const token = randomToken(32);
    const now = new Date();
    await db.delete(schema.loginTokens).where(lt(schema.loginTokens.expiresAt, new Date(now.getTime() - 24 * 3600_000)));
    await db.insert(schema.loginTokens).values({ userId: user.id, tokenHash: hashLoginToken(token), expiresAt: new Date(now.getTime() + LOGIN_TOKEN_TTL_MS) });
    const link = magicLinkUrl(env.PUBLIC_WEB_URL, token, body.next);

    if (env.DEV_LOGIN) {
      console.log(`[auth] DEV_LOGIN magic link for ${email}: ${link}`);
      return { ok: true, devLink: link };
    }
    // The link goes to the address as typed (aliases such as +tags still reach the same mailbox).
    await sendLoginEmail(body.email.trim(), link).catch((e: unknown) => {
      console.error("[auth] login e-mail failed:", (e as Error).message);
      throw new HttpError(502, "Could not send the e-mail. Please try again.", "email_failed");
    });
    return { ok: true };
  }),
);

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECS * 1000,
    path: "/",
  });
}

authRouter.get(
  "/verify",
  h(async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token.slice(0, 200) : "";
    const next = safeNextPath(req.query.next);
    const now = new Date();
    // Single use: the UPDATE consumes the token only if it is unused and not expired.
    const [used] = token
      ? await db
          .update(schema.loginTokens)
          .set({ usedAt: now })
          .where(and(eq(schema.loginTokens.tokenHash, hashLoginToken(token)), isNull(schema.loginTokens.usedAt), gt(schema.loginTokens.expiresAt, now)))
          .returning({ userId: schema.loginTokens.userId })
      : [];
    if (!used) {
      const retry = new URL("/login", env.PUBLIC_WEB_URL);
      retry.searchParams.set("error", "invalid_link");
      if (next !== "/") retry.searchParams.set("next", next);
      res.redirect(302, retry.toString());
      return;
    }
    const [user] = await db
      .update(schema.users)
      .set({ emailVerifiedAt: sql`coalesce(${schema.users.emailVerifiedAt}, now())` })
      .where(eq(schema.users.id, used.userId))
      .returning();
    await db.insert(schema.userProfiles).values({ userId: used.userId, email: user?.email ?? null }).onConflictDoNothing();
    setSessionCookie(res, await signSession(used.userId));
    res.redirect(302, webUrlFor(env.PUBLIC_WEB_URL, next));
  }),
);

authRouter.post(
  "/logout",
  h(async (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  }),
);

/** GET /api/auth/me and GET /api/me: the signed-in user (SessionUser in @solvers/shared). */
export const sessionUserHandler = h(async (req) => {
  const userId = requireUserId(req);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!user) throw new HttpError(401, "Sign in to continue", "unauthorized");
  return { userId: user.id, email: user.email, emailVerified: user.emailVerifiedAt !== null };
});

authRouter.get("/me", requireUser, sessionUserHandler);
