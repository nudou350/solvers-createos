// Error page of the OAuth authorization endpoint (consent itself happens on the web app's /connect page). Self-contained
// HTML; English by default, Portuguese (pt-BR) when the browser asks (Accept-Language) or ?lang=pt.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type PageLang = "en" | "pt";

/** Page language: ?lang=pt|en wins; else the first Accept-Language entry; English by default. */
export function pageLang(query?: unknown, acceptLanguage?: string): PageLang {
  if (query === "pt" || query === "en") return query;
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("pt") ? "pt" : "en";
}

const TEXT = {
  en: { htmlLang: "en", title: "Connect to Solvers", cannotContinue: "We couldn't continue" },
  pt: { htmlLang: "pt-BR", title: "Conectar ao Solvers", cannotContinue: "Não foi possível continuar" },
} as const;

export function oauthErrorPage(lang: PageLang, error: string): string {
  const t = TEXT[lang];
  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t.title}</title>
<style>
  :root { --bg:#f7f7f5; --card:#fff; --ink:#1b1b1f; --line:#e6e6e0; --accent:#6b4ce6; --accent2:#14b8a6; --err:#b42318; }
  @media (prefers-color-scheme: dark) { :root { --bg:#111114; --card:#1a1a1f; --ink:#f2f2f5; --line:#2a2a31; --err:#f97066; } }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:var(--bg); color:var(--ink);
         font:16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; padding:16px; }
  .card { width:100%; max-width:440px; background:var(--card); border:1px solid var(--line); border-radius:16px; padding:28px; }
  .brand { display:flex; align-items:center; gap:10px; font-weight:700; font-size:18px; margin-bottom:18px; }
  .dot { width:22px; height:22px; border-radius:7px; background:linear-gradient(135deg,var(--accent),var(--accent2)); }
  h1 { font-size:22px; margin:0 0 8px; }
  .error { color:var(--err); margin:0; }
</style>
</head>
<body>
<main class="card">
  <div class="brand"><span class="dot" aria-hidden="true"></span>Solvers</div>
  <h1>${t.cannotContinue}</h1><p class="error">${esc(error)}</p>
</main>
</body>
</html>`;
}
