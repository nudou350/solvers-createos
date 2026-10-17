import assert from "node:assert/strict";
import { test } from "node:test";
import { kpiHeadline } from "../src/components/creator/creator-rules";

test("kpiHeadline: cents below $10, whole dollars above", () => {
  assert.equal(kpiHeadline(45, "en-US"), "$0.45");
  assert.equal(kpiHeadline(0, "en-US"), "$0");
  assert.equal(kpiHeadline(950, "en-US"), "$9.50");
  assert.equal(kpiHeadline(123_440, "en-US"), "$1,234");
  assert.equal(kpiHeadline(123_460, "en-US"), "$1,235");
  assert.equal(kpiHeadline(45, "pt-BR").replace(/\s/g, " "), "US$ 0,45");
  assert.equal(kpiHeadline(500_000, "pt-BR").replace(/\s/g, " "), "US$ 5.000");
});
