// Unit tests of the web's pure helpers: error mapping (API codes, network failures, text written for the person),
// price formatting from cents, the post-login redirect guard and the Content-Security-Policy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ApiError } from "@solvers/api-client";
import { safeNext } from "../src/components/auth/next-path";
import { ClientError, errorInfo, errorText, UserFacingError, type ErrorsT } from "../src/lib/error-map";
import { formatUsd, toCents } from "../src/lib/format-money";
import { contentSecurityPolicy, makeNonce } from "../src/lib/csp";

type Tree = { [k: string]: string | Tree };
const messages = (locale: string): Tree => JSON.parse(readFileSync(new URL(`../messages/${locale}/errors.json`, import.meta.url), "utf8")) as Tree;

/** Minimal translator over errors.json ({name} placeholders only), with `has` like next-intl. */
function translator(locale: "en" | "pt"): ErrorsT {
  const root = messages(locale);
  const get = (key: string): string | undefined => {
    let cur: string | Tree | undefined = root;
    for (const part of key.split(".")) cur = typeof cur === "object" ? cur[part] : undefined;
    return typeof cur === "string" ? cur : undefined;
  };
  const t = ((key: string, values?: Record<string, string | number>) => {
    const s = get(key);
    if (s === undefined) throw new Error(`missing message errors.${key}`);
    return s.replace(/\{(\w+)\}/g, (_m, k: string) => String(values?.[k] ?? `{${k}}`));
  }) as ErrorsT;
  t.has = (key: string) => get(key) !== undefined;
  return t;
}

// ----- error mapping -----

test("API errors: known codes, titled notices, login and retry actions", () => {
  for (const loc of ["en", "pt"] as const) {
    const t = translator(loc);
    assert.equal(errorText(new ApiError(409, "already_owned", "x", {}), t), t("api.already_owned"));
    const login = errorInfo(new ApiError(401, "unauthorized", "x", {}), t);
    assert.equal(login.action, "login");
    assert.equal(login.title, t("notice.unauthorized.title"));
    assert.equal(errorInfo(new ApiError(429, "rate_limited", "x", {}), t).action, "retry");
    assert.equal(errorInfo(new ApiError(503, "internal", "x", {}), t).action, "retry");
    assert.equal(errorInfo(new ApiError(409, "wrong_step", "x", {}), t).title, t("notice.wrong_step.title"));
    // Unknown code: the server's message.
    assert.equal(errorText(new ApiError(400, "weird", "Server says no", {}), t), "Server says no");
  }
});

test("network failures, text written for the person, and anything else", () => {
  const t = translator("en");
  assert.equal(errorInfo(new TypeError("Failed to fetch"), t).code, "network");
  assert.equal(errorText(new UserFacingError("Written for you"), t), "Written for you");
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal(errorText(new Error("internal detail"), t), t("notice.unknown.text"));
    assert.equal(errorInfo(new ClientError("no_such_code"), t).code, "unknown");
  } finally {
    console.error = original;
  }
});

test("every titled notice has a title and text in both languages, with the same keys", () => {
  const en = messages("en");
  const pt = messages("pt");
  const keys = (tree: Tree) => Object.keys(tree.notice as Tree).sort();
  assert.deepEqual(keys(en), keys(pt));
  for (const loc of ["en", "pt"] as const) {
    const t = translator(loc);
    for (const k of keys(en)) assert.ok(t.has(`notice.${k}.title`) && t.has(`notice.${k}.text`), `${loc} notice.${k}`);
  }
});

test("prices are formatted from integer USD cents", () => {
  assert.equal(formatUsd(2499, "en-US"), "$24.99");
  assert.equal(formatUsd(2500, "en-US"), "$25");
  assert.equal(formatUsd("90000", "en-US"), "$900");
  assert.equal(formatUsd(123456, "en-US"), "$1,234.56");
  assert.equal(formatUsd(2499, "en-US", { round: true }), "$25");
  assert.equal(formatUsd(2499, "pt-BR")?.replace(/\s/g, " "), "US$ 24,99");
  assert.equal(formatUsd(24.5, "en-US"), null);
  assert.equal(formatUsd("12.5", "en-US"), null);
  assert.equal(toCents(10n), 10);
  assert.equal(toCents(null), null);
});

test("after sign-in, only a path of this site is followed", () => {
  assert.equal(safeNext("/solvers/x?buy=1"), "/solvers/x?buy=1");
  assert.equal(safeNext("/pt/library"), "/pt/library");
  for (const bad of [null, "", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"]) assert.equal(safeNext(bad), "/library", String(bad));
});

test("CSP: nonce-based script policy, eval only in development", () => {
  const n = makeNonce();
  assert.match(n, /^[A-Za-z0-9+/]{22}==$/);
  assert.notEqual(makeNonce(), n);
  const prod = contentSecurityPolicy(n, { dev: false });
  const script = prod.split("; ").find((d) => d.startsWith("script-src "))!;
  assert.ok(script.includes(`'nonce-${n}'`) && script.includes("'strict-dynamic'"));
  assert.ok(!/unsafe-inline|unsafe-eval/.test(prod));
  assert.match(prod, /object-src 'none'/);
  assert.match(prod, /base-uri 'self'/);
  assert.match(prod, /frame-ancestors 'none'/);
  assert.match(contentSecurityPolicy(n, { dev: true }), /'unsafe-eval'/);
  assert.throws(() => contentSecurityPolicy("x'; script-src *", { dev: false }));
});
