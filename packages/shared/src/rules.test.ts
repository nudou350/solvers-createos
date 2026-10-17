import { test } from "node:test";
import assert from "node:assert/strict";
import { averageRating, bpsToScore, creatorReputationScore, reputationScore, scoreToBps } from "./rules.js";

test("reputation", () => {
  assert.equal(reputationScore(0, 0), 50);
  assert.equal(reputationScore(30, 0), 80);
  assert.equal(reputationScore(2, 2), 23);
  assert.equal(reputationScore(0, 10), 0);
});

test("rating", () => {
  assert.equal(averageRating(14, 3), 4.7);
  assert.equal(averageRating(14n, 3), 4.7);
  assert.equal(averageRating(0, 0), 0);
});

test("creator reputation", () => {
  assert.equal(creatorReputationScore(0, 0, 0), 50);
  assert.equal(creatorReputationScore(40, 5, 0), 90);
  assert.equal(creatorReputationScore(10, 4, 2), 40);
});

test("score <-> bps", () => {
  assert.equal(bpsToScore(8750), 87.5);
  assert.equal(scoreToBps(87.5), 8750);
});
