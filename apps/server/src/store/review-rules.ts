import { sha256Hex } from "../lib/crypto.js";

// Pure review rules (no env/database), tested in test/review.test.ts.

/** `content_hash` of a review text: sha256(utf8 text), 64 lowercase hex. */
export function reviewContentHash(text: string): string {
  return sha256Hex(text);
}
