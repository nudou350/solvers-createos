import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { unauthorized } from "../lib/http.js";
import { mcpAudience, SESSION_COOKIE, verifyToken, WEB_AUDIENCE, type TokenClaims } from "./jwt.js";

// Who is calling: the web session (cookie `solvers_session`, or the same JWT as a Bearer) or an MCP connector token
// (Bearer, audience /mcp, its oauth_tokens row still active). Both set `req.userId` (users.id) and `req.tokenId`.

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
}

/** An active (not revoked, not expired) connector token row. */
export async function activeOAuthToken(tokenId: string) {
  const [tok] = await db
    .select({ id: schema.oauthTokens.id, clientId: schema.oauthTokens.clientId, userId: schema.oauthTokens.userId })
    .from(schema.oauthTokens)
    .where(and(eq(schema.oauthTokens.id, tokenId), eq(schema.oauthTokens.revoked, false), gt(schema.oauthTokens.expiresAt, new Date())));
  return tok ?? null;
}

async function claimsOf(token: string): Promise<TokenClaims | null> {
  const web = await verifyToken(token, WEB_AUDIENCE).catch(() => null);
  if (web) return web;
  const mcp = await verifyToken(token, mcpAudience()).catch(() => null);
  if (!mcp?.jti) return null;
  const tok = await activeOAuthToken(mcp.jti);
  return tok && tok.userId === mcp.sub ? mcp : null;
}

async function authenticate(req: Request): Promise<boolean> {
  const token = extractToken(req);
  if (!token) return false;
  const claims = await claimsOf(token);
  if (!claims) return false;
  req.userId = claims.sub;
  req.tokenId = claims.jti;
  return true;
}

/** Sets `req.userId` when the request carries a valid session or token; anonymous otherwise. */
export async function optionalUser(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.userId) await authenticate(req);
    next();
  } catch (e) {
    next(e);
  }
}

/** 401 unless the request carries a valid session or connector token. */
export async function requireUser(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.userId || (await authenticate(req))) return next();
    next(unauthorized());
  } catch (e) {
    next(e);
  }
}

/** The authenticated user id inside a handler (401 when missing). */
export function requireUserId(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}
