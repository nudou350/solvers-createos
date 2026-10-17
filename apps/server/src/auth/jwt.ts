import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomBytes } from "node:crypto";
import { env } from "../env.js";

const secret = new TextEncoder().encode(env.JWT_SECRET);
export const WEB_AUDIENCE = "solvers-web";
export const SESSION_COOKIE = "solvers_session";
export const SESSION_TTL_SECS = 24 * 3600;

export const mcpAudience = () => `${env.PUBLIC_API_URL.replace(/\/$/, "")}/mcp`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Web session JWT (cookie or Bearer). The subject is `users.id`. */
export async function signSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(`web_${randomBytes(12).toString("hex")}`)
    .setAudience(WEB_AUDIENCE)
    .setIssuer(env.PUBLIC_API_URL)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECS}s`)
    .sign(secret);
}

/** MCP access token (OAuth): audience = the /mcp resource, `jti` = the oauth_tokens row, `cid` = the client. */
export async function signAccessToken(userId: string, tokenId: string, clientId: string, ttlSecs: number): Promise<string> {
  return new SignJWT({ cid: clientId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(tokenId)
    .setAudience(mcpAudience())
    .setIssuer(env.PUBLIC_API_URL)
    .setIssuedAt()
    .setExpirationTime(`${ttlSecs}s`)
    .sign(secret);
}

export type TokenClaims = { sub: string; jti?: string; cid?: string; exp?: number };

/** Verifies a session or access token; the subject must be a user id (tokens of the old identity are refused). */
export async function verifyToken(token: string, audience: string): Promise<TokenClaims> {
  const { payload } = await jwtVerify(token, secret, { audience, issuer: env.PUBLIC_API_URL });
  if (!payload.sub || !UUID.test(payload.sub)) throw new Error("token without a user id");
  return { ...(payload as TokenClaims), sub: payload.sub.toLowerCase() };
}

/** Short-lived signed server state (e.g. a pending OAuth authorization request), so nothing has to be stored. */
export async function signState(data: Record<string, unknown>, audience: string, ttlSecs: number): Promise<string> {
  return new SignJWT({ data })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(audience)
    .setIssuer(env.PUBLIC_API_URL)
    .setIssuedAt()
    .setExpirationTime(`${ttlSecs}s`)
    .sign(secret);
}

/** The data of a `signState` token, or null when it is invalid or expired. */
export async function verifyState<T>(token: string, audience: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify<JWTPayload & { data: T }>(token, secret, { audience, issuer: env.PUBLIC_API_URL });
    return payload.data ?? null;
  } catch {
    return null;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Authenticated user (`users.id`), from the web session or the connector token. */
      userId?: string;
      /** Session/token id (jti). */
      tokenId?: string;
    }
  }
}
