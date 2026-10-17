import express, { Router, type Express, type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { eq, lt } from "drizzle-orm";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db, schema, type Db } from "../db/index.js";
import { env } from "../env.js";
import { h, HttpError, parse } from "../lib/http.js";
import { randomId, randomToken, sha256Hex } from "../lib/crypto.js";
import { mcpAudience, signAccessToken, signState, verifyState, verifyToken } from "../auth/jwt.js";
import { requireUser, requireUserId } from "../auth/middleware.js";
import { oauthErrorPage, pageLang } from "./page.js";
import { refreshRejection, sameOrigin } from "./rules.js";

// Authorization of the MCP connector (Claude, ChatGPT): /mcp is a resource server and this app is also the authorization
// server (OAuth 2.1 + PKCE S256 + dynamic client registration). The person approves on the web app's /connect page,
// signed in with the web session (e-mail magic link); approving issues the code for that `users.id`.

const ACCESS_TTL_SECS = 24 * 3600;
const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000;
const CODE_TTL_MS = 5 * 60 * 1000;
const AUTH_REQ_TTL_SECS = 10 * 60;
const AUTH_REQ_AUDIENCE = "solvers-oauth-request";

const base = () => env.PUBLIC_API_URL.replace(/\/$/, "");

class OAuthError extends HttpError {
  constructor(error: string, description: string, status = 400) {
    super(status, description, error, { error, error_description: description });
  }
}

export function protectedResourceMetadata() {
  return {
    resource: mcpAudience(),
    authorization_servers: [base()],
    scopes_supported: ["solvers"],
    bearer_methods_supported: ["header"],
    resource_name: "Solvers",
    resource_documentation: `${env.PUBLIC_WEB_URL.replace(/\/$/, "")}/install`,
  };
}

export function authorizationServerMetadata() {
  return {
    issuer: base(),
    authorization_endpoint: `${base()}/oauth/authorize`,
    token_endpoint: `${base()}/oauth/token`,
    registration_endpoint: `${base()}/oauth/register`,
    revocation_endpoint: `${base()}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["solvers"],
  };
}

const RegisterBody = z.object({
  redirect_uris: z.array(z.string().url()).min(1).max(10),
  client_name: z.string().max(200).optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  token_endpoint_auth_method: z.string().optional(),
  scope: z.string().optional(),
  client_uri: z.string().optional(),
  logo_uri: z.string().optional(),
});

function allowedRedirect(uri: string): boolean {
  const u = new URL(uri);
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
}

async function getClient(clientId: string) {
  const [c] = await db.select().from(schema.oauthClients).where(eq(schema.oauthClients.clientId, clientId));
  return c ? { ...c, meta: c.metadata as { redirect_uris: string[]; client_name?: string } } : null;
}

const AuthorizeQuery = z.object({
  response_type: z.literal("code"),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal("S256"),
  state: z.string().max(1000).optional(),
  scope: z.string().optional(),
  resource: z.string().optional(),
});

type AuthRequest = z.infer<typeof AuthorizeQuery> & { clientName: string };

/** The pending request travels signed in the /connect URL (`req`), valid for 10 minutes: nothing is stored. */
function saveAuthRequest(req: AuthRequest): Promise<string> {
  return signState(req, AUTH_REQ_AUDIENCE, AUTH_REQ_TTL_SECS);
}

async function loadAuthRequest(id: string): Promise<AuthRequest> {
  const ar = await verifyState<AuthRequest>(id, AUTH_REQ_AUDIENCE);
  if (!ar) throw new OAuthError("invalid_request", "The authorization request has expired. Go back to Claude/ChatGPT and connect again.");
  return ar;
}

/** Known clients: the page shows the destination as verified; the others get a warning. */
const KNOWN_REDIRECT_HOSTS = ["claude.ai", "claude.com", "chatgpt.com", "chat.openai.com", "openai.com", "localhost", "127.0.0.1"];

function redirectInfo(uri: string) {
  const host = new URL(uri).hostname;
  const verified = KNOWN_REDIRECT_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  return { host, verified };
}

function s256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** `exec` lets tokens be issued inside a transaction (refresh rotation: all or nothing). */
export async function issueTokens(clientId: string, userId: string, exec: Pick<Db, "insert"> = db) {
  const tokenId = `tok_${randomId(12)}`;
  const refresh = randomToken(32);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await exec.insert(schema.oauthTokens).values({ id: tokenId, clientId, userId, refreshHash: sha256Hex(refresh), expiresAt });
  const access = await signAccessToken(userId, tokenId, clientId, ACCESS_TTL_SECS);
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SECS,
    refresh_token: refresh,
    scope: "solvers",
  };
}

export const oauthRouter = Router();
const open = cors({ origin: true });

oauthRouter.use(
  rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? "0.0.0.0"),
    message: { error: "too_many_requests", error_description: "Too many attempts. Please wait a minute." },
  }),
);

oauthRouter.post(
  "/register",
  open,
  express.json(),
  h(async (req, res) => {
    const body = RegisterBody.safeParse(req.body);
    if (!body.success) throw new OAuthError("invalid_client_metadata", body.error.issues[0]?.message ?? "invalid metadata");
    for (const uri of body.data.redirect_uris) {
      if (!allowedRedirect(uri)) throw new OAuthError("invalid_redirect_uri", `redirect_uri not allowed: ${uri}`);
    }
    const clientId = `cli_${randomId(12)}`;
    const metadata = {
      redirect_uris: body.data.redirect_uris,
      client_name: body.data.client_name ?? "MCP client",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "solvers",
    };
    await db.insert(schema.oauthClients).values({ clientId, metadata });
    res.status(201);
    return { client_id: clientId, client_id_issued_at: Math.floor(Date.now() / 1000), ...metadata };
  }),
);

oauthRouter.get(
  "/authorize",
  h(async (req, res) => {
    const lang = pageLang(req.query.lang, req.headers["accept-language"]);
    const q = AuthorizeQuery.safeParse(req.query);
    if (!q.success) {
      res.status(400).type("html").send(oauthErrorPage(lang, "Invalid authorization request. Try connecting again from Claude or ChatGPT."));
      return;
    }
    const client = await getClient(q.data.client_id);
    if (!client || !client.meta.redirect_uris.includes(q.data.redirect_uri)) {
      res.status(400).type("html").send(oauthErrorPage(lang, "App not recognized. Try connecting again."));
      return;
    }
    if (q.data.resource && q.data.resource.replace(/\/$/, "") !== mcpAudience()) {
      res.status(400).type("html").send(oauthErrorPage(lang, "The requested resource does not belong to this server."));
      return;
    }
    const clientName = client.meta.client_name ?? "Your AI assistant";
    const id = await saveAuthRequest({ ...q.data, clientName });
    // Consent happens on the web app (/connect), where the person signs in with e-mail if needed.
    res.redirect(302, `${env.PUBLIC_WEB_URL.replace(/\/$/, "")}/connect?req=${encodeURIComponent(id)}`);
  }),
);

/** Request data for the web app's consent screen. */
oauthRouter.get(
  "/authorize/info",
  h(async (req) => {
    const { req: id } = parse(z.object({ req: z.string().max(8000) }), req.query);
    const ar = await loadAuthRequest(id);
    const { host, verified } = redirectInfo(ar.redirect_uri);
    return { clientName: ar.clientName, redirectHost: host, verified };
  }),
);

/** Consent must come from the web app: a request from another origin is refused (CSRF), on top of the SameSite cookie. */
function fromWebApp(req: Request, _res: Response, next: NextFunction) {
  if (sameOrigin(req.headers.origin, env.PUBLIC_WEB_URL)) return next();
  next(new OAuthError("access_denied", "Approve the connection on the Solvers site.", 403));
}

/** Consent from the web app's /connect page, signed in (cookie `solvers_session`): issues the code for that user. */
oauthRouter.post(
  "/authorize/complete",
  fromWebApp,
  cookieParser(),
  requireUser,
  express.json(),
  h(async (req) => {
    const userId = requireUserId(req);
    const body = parse(z.object({ req: z.string().max(8000) }), req.body);
    const ar = await loadAuthRequest(body.req);
    const code = randomToken(24);
    await db.delete(schema.oauthCodes).where(lt(schema.oauthCodes.expiresAt, new Date()));
    await db.insert(schema.oauthCodes).values({
      code,
      clientId: ar.client_id,
      userId,
      codeChallenge: ar.code_challenge,
      redirectUri: ar.redirect_uri,
      scope: ar.scope ?? "solvers",
      resource: ar.resource ?? mcpAudience(),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });
    const url = new URL(ar.redirect_uri);
    url.searchParams.set("code", code);
    if (ar.state) url.searchParams.set("state", ar.state);
    return { redirectTo: url.toString() };
  }),
);

oauthRouter.post(
  "/token",
  open,
  express.urlencoded({ extended: false }),
  express.json(),
  h(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const b = req.body as Record<string, string>;
    if (b.grant_type === "authorization_code") {
      if (!b.code || !b.code_verifier || !b.client_id) throw new OAuthError("invalid_request", "code, code_verifier and client_id are required");
      const [row] = await db.delete(schema.oauthCodes).where(eq(schema.oauthCodes.code, b.code)).returning();
      if (!row || row.expiresAt < new Date()) throw new OAuthError("invalid_grant", "Invalid or expired code");
      if (row.clientId !== b.client_id) throw new OAuthError("invalid_grant", "Code belongs to another client");
      if (b.redirect_uri && b.redirect_uri !== row.redirectUri) throw new OAuthError("invalid_grant", "redirect_uri does not match");
      if (s256(b.code_verifier) !== row.codeChallenge) throw new OAuthError("invalid_grant", "Invalid PKCE");
      if (b.resource && b.resource.replace(/\/$/, "") !== mcpAudience()) throw new OAuthError("invalid_target", "Invalid resource");
      return issueTokens(row.clientId, row.userId);
    }
    if (b.grant_type === "refresh_token") {
      if (!b.refresh_token) throw new OAuthError("invalid_request", "refresh_token is required");
      const refreshHash = sha256Hex(b.refresh_token);
      // All-or-nothing rotation: revoke the old refresh token and issue the successor in one transaction. A failure midway
      // rolls everything back and the client keeps a valid old refresh token. The row is locked (for update): a second
      // request with the same refresh token waits and then sees it revoked.
      return db.transaction(async (tx) => {
        const [tok] = await tx.select().from(schema.oauthTokens).where(eq(schema.oauthTokens.refreshHash, refreshHash)).for("update");
        // Validate before revoking: an invalid request never consumes the legitimate client's token.
        const rejection = refreshRejection(tok, b.client_id, new Date());
        if (rejection || !tok) throw new OAuthError("invalid_grant", rejection ?? "Invalid or expired refresh token");
        await tx.update(schema.oauthTokens).set({ revoked: true }).where(eq(schema.oauthTokens.id, tok.id));
        return issueTokens(tok.clientId, tok.userId, tx);
      });
    }
    throw new OAuthError("unsupported_grant_type", "Unsupported grant_type");
  }),
);

oauthRouter.post(
  "/revoke",
  open,
  express.urlencoded({ extended: false }),
  express.json(),
  h(async (req) => {
    const token = (req.body as Record<string, string>).token;
    if (token) {
      const [byRefresh] = await db
        .update(schema.oauthTokens)
        .set({ revoked: true })
        .where(eq(schema.oauthTokens.refreshHash, sha256Hex(token)))
        .returning({ id: schema.oauthTokens.id });
      if (!byRefresh) {
        // It may be the access token (JWT): revoke by jti.
        const claims = await verifyToken(token, mcpAudience()).catch(() => null);
        if (claims?.jti) await db.update(schema.oauthTokens).set({ revoked: true }).where(eq(schema.oauthTokens.id, claims.jti));
      }
    }
    return {};
  }),
);

export function mountOAuth(app: Express) {
  const wellKnown = Router();
  wellKnown.use(open);
  wellKnown.get(["/oauth-protected-resource", "/oauth-protected-resource/mcp"], (_req, res) => {
    res.json(protectedResourceMetadata());
  });
  wellKnown.get(["/oauth-authorization-server", "/oauth-authorization-server/mcp", "/openid-configuration"], (_req, res) => {
    res.json(authorizationServerMetadata());
  });
  app.use("/.well-known", wellKnown);
  app.use("/oauth", oauthRouter);
}
