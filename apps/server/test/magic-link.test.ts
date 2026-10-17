import "./helpers/fake-env.js";
import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { hashLoginToken, magicLinkUrl, safeNextPath, webUrlFor } from "../src/auth/magic-link-rules.js";
import { signSession, verifyToken, WEB_AUDIENCE, signState, verifyState } from "../src/auth/jwt.js";

// Magic-link rules and the session/state JWTs (no database).

describe("safeNextPath", () => {
  it("keeps same-site paths with their query", () => {
    assert.equal(safeNextPath("/library"), "/library");
    assert.equal(safeNextPath("/connect?req=abc.def"), "/connect?req=abc.def");
  });

  it("anything that could leave the site becomes /", () => {
    for (const bad of [undefined, 42, "", "library", "https://evil.test", "//evil.test", "/\\evil.test", "/a\nb", "javascript:alert(1)"]) {
      assert.equal(safeNextPath(bad), "/", String(bad));
    }
  });
});

describe("magicLinkUrl", () => {
  it("points at the web origin's /api/auth/verify with the token and a safe next", () => {
    const u = new URL(magicLinkUrl("http://localhost:3041", "tok_1", "/connect?req=x"));
    assert.equal(u.origin, "http://localhost:3041");
    assert.equal(u.pathname, "/api/auth/verify");
    assert.equal(u.searchParams.get("token"), "tok_1");
    assert.equal(u.searchParams.get("next"), "/connect?req=x");
  });

  it("drops an unsafe or empty next", () => {
    assert.equal(new URL(magicLinkUrl("http://localhost:3041", "t", "https://evil.test")).searchParams.get("next"), null);
    assert.equal(new URL(magicLinkUrl("http://localhost:3041", "t")).searchParams.get("next"), null);
  });

  it("webUrlFor never leaves the web origin", () => {
    assert.equal(webUrlFor("https://solvers.example", "/library"), "https://solvers.example/library");
    assert.equal(webUrlFor("https://solvers.example", "//evil.test"), "https://solvers.example/");
  });
});

describe("hashLoginToken", () => {
  it("is stable, hex, and not the token", () => {
    assert.match(hashLoginToken("abc"), /^[0-9a-f]{64}$/);
    assert.equal(hashLoginToken("abc"), hashLoginToken("abc"));
    assert.notEqual(hashLoginToken("abc"), hashLoginToken("abd"));
  });
});

describe("session JWT", () => {
  it("carries the user id as subject", async () => {
    const id = randomUUID();
    const claims = await verifyToken(await signSession(id), WEB_AUDIENCE);
    assert.equal(claims.sub, id);
    assert.match(claims.jti!, /^web_/);
  });

  it("refuses a token whose subject is not a user id", async () => {
    await assert.rejects(verifyToken(await signSession("0xabc"), WEB_AUDIENCE));
  });

  it("refuses another audience", async () => {
    await assert.rejects(verifyToken(await signSession(randomUUID()), "other"));
  });
});

describe("signed state (pending OAuth request)", () => {
  it("round-trips and is bound to its audience", async () => {
    const t = await signState({ client_id: "cli_1" }, "a", 60);
    assert.deepEqual(await verifyState(t, "a"), { client_id: "cli_1" });
    assert.equal(await verifyState(t, "b"), null);
    assert.equal(await verifyState(t.replace(/\.[^.]+\./, ".e30."), "a"), null, "tampered payload");
  });
});
