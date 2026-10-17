import "./helpers/fake-env.js";
process.env.MEMORY_KEK ??= Buffer.alloc(32, 9).toString("base64");
import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";

// Memory data key (decisions.md D8): a random per-user key stored only wrapped with MEMORY_KEK; no database here.

const { unwrapKey, wrapKey } = await import("../src/memory/crypto.js");

describe("memory data key wrapping", () => {
  it("wrap/unwrap round-trips a 32-byte key", () => {
    const dek = randomBytes(32);
    const wrapped = wrapKey(dek);
    assert.equal(wrapped.length, 12 + 16 + 32);
    assert.ok(unwrapKey(wrapped).equals(dek));
  });

  it("each wrap uses a fresh iv, so the same key never wraps to the same bytes", () => {
    const dek = randomBytes(32);
    assert.ok(!wrapKey(dek).equals(wrapKey(dek)));
  });

  it("a tampered wrapped key does not open", () => {
    const wrapped = wrapKey(randomBytes(32));
    wrapped[wrapped.length - 1] ^= 1;
    assert.throws(() => unwrapKey(wrapped));
  });
});
