import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { sha256Hex } from "../src/lib/crypto.js";
import { reviewContentHash } from "../src/store/review-rules.js";

// Reviews: the stored content hash is the sha256 of the text (no env or database).

describe("reviewContentHash", () => {
  it("is the sha256 of the text, 64 lowercase hex", () => {
    assert.equal(reviewContentHash("ótimo"), sha256Hex("ótimo"));
    assert.match(reviewContentHash(""), /^[0-9a-f]{64}$/);
  });

  it("changes with the text", () => {
    assert.notEqual(reviewContentHash("ótimo!"), reviewContentHash("ótimo"));
  });
});
