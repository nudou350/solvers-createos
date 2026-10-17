import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { env } from "../env.js";
import { mcpAudience, verifyToken } from "../auth/jwt.js";
import { activeOAuthToken } from "../auth/middleware.js";
import { buildMcpServer } from "./tools.js";

const resourceMetadataUrl = () => `${env.PUBLIC_API_URL.replace(/\/$/, "")}/.well-known/oauth-protected-resource/mcp`;

function challenge(res: Response, error?: string) {
  const parts = [`Bearer resource_metadata="${resourceMetadataUrl()}"`];
  if (error) parts.push(`error="${error}"`);
  res.setHeader("WWW-Authenticate", parts.join(", "));
  res.status(401).json({ error: error ?? "unauthorized", error_description: "Sign in to Solvers to use the specialists." });
}

/** No valid token: 401 with WWW-Authenticate pointing to the resource metadata (triggers OAuth in the client). */
async function bearer(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return challenge(res);
  try {
    const claims = await verifyToken(auth.slice(7), mcpAudience());
    if (!claims.jti) return challenge(res, "invalid_token");
    const tok = await activeOAuthToken(claims.jti);
    if (!tok || tok.userId !== claims.sub) return challenge(res, "invalid_token");
    req.userId = claims.sub;
    req.tokenId = claims.jti;
    next();
  } catch {
    challenge(res, "invalid_token");
  }
}

export function mountMcp(app: Express) {
  const perUser = rateLimit({
    windowMs: 60_000,
    limit: env.RATE_LIMIT_PER_MINUTE,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => req.userId ?? "anon",
    message: { jsonrpc: "2.0", error: { code: -32000, message: "Too many calls per minute. Please wait a moment." }, id: null },
  });

  const handler = async (req: Request, res: Response) => {
    // Stateless mode: one MCP server per request, bound to the token's user.
    const server = buildMcpServer({ userId: req.userId!, tokenId: req.tokenId });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      console.error("[mcp] error", e);
      if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
    }
  };

  const mcpCors = cors({ origin: true, exposedHeaders: ["WWW-Authenticate", "Mcp-Session-Id"] });
  app.options("/mcp", mcpCors);
  app.post("/mcp", mcpCors, express.json({ limit: "1mb" }), bearer, perUser, handler);
  // No stateful sessions: GET (server stream) and DELETE do not apply.
  app.get("/mcp", mcpCors, bearer, (_req, res) => {
    res.status(405).setHeader("Allow", "POST").json({ jsonrpc: "2.0", error: { code: -32000, message: "Use POST" }, id: null });
  });
  app.delete("/mcp", mcpCors, bearer, (_req, res) => {
    res.status(405).setHeader("Allow", "POST").end();
  });
}
