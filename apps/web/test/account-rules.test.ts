// Pure helpers of the account screens. Run: cd apps/web && node --import tsx --test test/*.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { BOUGHT_POLL, boughtSlug, boughtState } from "../src/components/account/account-rules";

test("boughtSlug: accepts slugs, refuses anything else", () => {
  assert.equal(boughtSlug("createos-builder"), "createos-builder");
  assert.equal(boughtSlug("  CreateOS-Builder "), "createos-builder");
  assert.equal(boughtSlug(null), null);
  assert.equal(boughtSlug(""), null);
  assert.equal(boughtSlug("../admin"), null);
  assert.equal(boughtSlug("a b"), null);
  assert.equal(boughtSlug("-leading"), null);
});

test("boughtState: done only when the Solver is already in the library", () => {
  assert.equal(boughtState("createos-builder", ["other", "createos-builder"]), "done");
  assert.equal(boughtState("createos-builder", new Set(["CreateOS-Builder"])), "done");
  assert.equal(boughtState("createos-builder", []), "confirming");
  assert.equal(boughtState("createos-builder", ["other"]), "confirming");
});

test("BOUGHT_POLL stays short (the webhook usually lands in seconds)", () => {
  assert.ok(BOUGHT_POLL.attempts * BOUGHT_POLL.intervalMs <= 30_000);
});
