import type { NextConfig } from "next";
import path from "node:path";

// next-intl finds the request config through the next-intl/config alias. The alias is set here instead of using the
// plugin (next-intl/plugin), which loads native @swc/core and @parcel/watcher only for the message extractor and breaks
// on Windows.
const I18N_REQUEST = "./src/i18n/request.ts";

// Same origin: the front calls /api/... with relative paths. In dev, Next rewrites the server routes to the local API;
// in production nginx does it, or Next itself when API_PROXY_URL is set at build time (CreateOS, apps/web/Dockerfile).
const API_DEV =
  process.env.API_PROXY_URL || (process.env.NODE_ENV === "production" ? "" : (process.env.API_DEV_URL ?? "http://localhost:3038"));
const PROXIED = ["/api", "/mcp", "/oauth", "/preview", "/.well-known", "/health"];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@solvers/api-client", "@solvers/shared"],
  poweredByHeader: false,
  turbopack: { resolveAlias: { "next-intl/config": I18N_REQUEST } },
  webpack(config) {
    config.resolve.alias = { ...config.resolve.alias, "next-intl/config": path.resolve(import.meta.dirname, I18N_REQUEST) };
    return config;
  },
  async headers() {
    // The Content-Security-Policy (script-src with a per-request nonce, frame-ancestors 'none') is sent by src/proxy.ts
    // on every page: a nonce cannot be static (lib/csp.ts). Here: X-Frame-Options for older browsers on the connector
    // consent screen, package review (/admin) and the creator area (/creator), which show third-party content and
    // powerful actions (approve, publish). Headers are only ADDED here; nothing loosens a header the app already sends.
    // Creator content is always escaped text, never HTML (components/admin/ReviewDetail.tsx).
    const guarded = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ];
    // Each area exists without a prefix (English) and with /pt.
    const both = (p: string) => [p, `/pt${p}`];
    return [
      ...both("/connect").map((source) => ({
        source,
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      })),
      ...both("/admin/:path*").map((source) => ({ source, headers: [...guarded, { key: "Cache-Control", value: "no-store" }] })),
      ...both("/creator/:path*").map((source) => ({ source, headers: guarded })),
    ];
  },
  async redirects() {
    // Old Portuguese routes (links already shared): 301 to the new ones, keeping Portuguese.
    const OLD: [string, string][] = [
      ["/especialistas/:slug", "/solvers/:slug"],
      ["/biblioteca/memorias", "/library/memories"],
      ["/biblioteca", "/library"],
      ["/checkout/concluido", "/checkout/done"],
      ["/conectar", "/connect"],
      ["/criador/envios/:id", "/creator/submissions/:id"],
      ["/criador/envios", "/creator/submissions"],
      ["/criador/publicar", "/creator/publish"],
      ["/criador", "/creator"],
      ["/criadores/:id", "/creators/:id"],
      ["/instalar", "/install"],
      ["/perfil", "/profile"],
      ["/admin/revisoes/:id", "/admin/reviews/:id"],
      ["/admin/revisoes", "/admin/reviews"],
    ];
    return OLD.flatMap(([from, to]) => [
      { source: from, destination: `/pt${to}`, permanent: true },
      { source: `/pt${from}`, destination: `/pt${to}`, permanent: true },
    ]);
  },
  async rewrites() {
    if (!API_DEV) return [];
    return PROXIED.flatMap((p) => [
      { source: p, destination: `${API_DEV}${p}` },
      { source: `${p}/:path*`, destination: `${API_DEV}${p}/:path*` },
    ]);
  },
};

export default nextConfig;
