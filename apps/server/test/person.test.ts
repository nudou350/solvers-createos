import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { normalizeEmail } from "../src/auth/person.js";

// Person identity: the canonical e-mail of users.email (no env or database).

describe("normalizeEmail", () => {
  it("lowercase and trimmed", () => {
    assert.equal(normalizeEmail("  Maria@Exemplo.COM "), "maria@exemplo.com");
  });

  it("drops the +tag on any domain", () => {
    assert.equal(normalizeEmail("maria+teste2@exemplo.com"), "maria@exemplo.com");
    assert.equal(normalizeEmail("maria+a+b@outlook.com"), "maria@outlook.com");
  });

  it("Gmail: no dots and googlemail.com becomes gmail.com", () => {
    assert.equal(normalizeEmail("m.a.r.i.a+x@gmail.com"), "maria@gmail.com");
    assert.equal(normalizeEmail("maria@googlemail.com"), "maria@gmail.com");
  });

  it("outside Gmail the dots count", () => {
    assert.equal(normalizeEmail("ma.ria@exemplo.com"), "ma.ria@exemplo.com");
    assert.notEqual(normalizeEmail("ma.ria@exemplo.com"), normalizeEmail("maria@exemplo.com"));
  });

  it("domain with a trailing dot and full-width characters", () => {
    assert.equal(normalizeEmail("maria@exemplo.com."), "maria@exemplo.com");
    assert.equal(normalizeEmail("ｍａｒｉａ@exemplo.com"), "maria@exemplo.com");
  });

  it("invalid: null", () => {
    for (const bad of ["", "maria", "@exemplo.com", "maria@", "maria@exemplo", "+x@gmail.com", "...@gmail.com", "a b@exemplo.com", "a@b@exemplo.com"]) {
      assert.equal(normalizeEmail(bad), null, bad);
    }
  });
});
