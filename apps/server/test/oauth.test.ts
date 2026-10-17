import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { refreshRejection, sameOrigin } from "../src/oauth/rules.js";
import { oauthErrorPage, pageLang } from "../src/oauth/page.js";

// Refresh rotation (everything validated before revoking), the consent origin check and the error page; no env or database.

const now = new Date("2026-01-10T00:00:00Z");
const ok = { clientId: "cli_a", revoked: false, expiresAt: new Date("2026-02-01T00:00:00Z") };

describe("refreshRejection", () => {
  it("valid token, with or without a matching client_id: may rotate", () => {
    assert.equal(refreshRejection(ok, undefined, now), null);
    assert.equal(refreshRejection(ok, "cli_a", now), null);
  });

  it("missing, revoked or expired: invalid", () => {
    assert.match(refreshRejection(undefined, "cli_a", now)!, /Invalid or expired/);
    assert.match(refreshRejection({ ...ok, revoked: true }, "cli_a", now)!, /Invalid or expired/);
    assert.match(refreshRejection({ ...ok, expiresAt: new Date("2026-01-09T00:00:00Z") }, "cli_a", now)!, /Invalid or expired/);
  });

  it("another client's client_id is refused", () => {
    assert.match(refreshRejection(ok, "cli_b", now)!, /another client/);
  });
});

describe("sameOrigin (consent must come from the web app)", () => {
  it("accepts the web origin, with or without a trailing path on the configured URL", () => {
    assert.equal(sameOrigin("http://localhost:3041", "http://localhost:3041"), true);
    assert.equal(sameOrigin("https://solvers.example", "https://solvers.example/"), true);
  });

  it("refuses a missing, malformed or different origin (scheme, host or port)", () => {
    assert.equal(sameOrigin(undefined, "http://localhost:3041"), false);
    assert.equal(sameOrigin("null", "http://localhost:3041"), false);
    assert.equal(sameOrigin("http://localhost:3000", "http://localhost:3041"), false);
    assert.equal(sameOrigin("https://evil.test", "https://solvers.example"), false);
    assert.equal(sameOrigin("http://solvers.example", "https://solvers.example"), false);
  });
});

describe("authorization error page", () => {
  it("pageLang: ?lang wins, then Accept-Language; English by default", () => {
    assert.equal(pageLang(undefined, undefined), "en");
    assert.equal(pageLang(undefined, "pt-BR,pt;q=0.9,en;q=0.8"), "pt");
    assert.equal(pageLang(undefined, "en-US,en;q=0.9"), "en");
    assert.equal(pageLang("en", "pt-BR"), "en");
    assert.equal(pageLang("pt", "en-US"), "pt");
    assert.equal(pageLang("fr", "de"), "en");
  });

  it("escapes the message and uses the title of the language", () => {
    const html = oauthErrorPage("en", "<b>x</b>");
    assert.match(html, /<html lang="en">/);
    assert.match(html, /We couldn't continue/);
    assert.doesNotMatch(html, /<b>x<\/b>/);
    assert.match(oauthErrorPage("pt", "x"), /Não foi possível continuar/);
  });
});
