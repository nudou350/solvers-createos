import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CURRENCY,
  MAX_BPS,
  MIN_PRICE_CENTS,
  PLATFORM_FEE_BPS,
  centsToDollars,
  dollarsToCents,
  feeSplit,
  formatCents,
  fromCents,
  isCents,
  parseDollars,
} from "./money.js";

test("constants", () => {
  assert.equal(MAX_BPS, 10_000);
  assert.equal(PLATFORM_FEE_BPS, 1_000);
  assert.equal(MIN_PRICE_CENTS, 500);
  assert.equal(CURRENCY, "usd");
});

test("feeSplit: 10% floor, remainder to the creator", () => {
  assert.deepEqual(feeSplit(900), { fee: 90, rest: 810 });
  assert.deepEqual(feeSplit(999), { fee: 99, rest: 900 });
  assert.deepEqual(feeSplit(19), { fee: 1, rest: 18 });
  assert.deepEqual(feeSplit(9), { fee: 0, rest: 9 });
  assert.deepEqual(feeSplit(0), { fee: 0, rest: 0 });
  assert.deepEqual(feeSplit(500, 0), { fee: 0, rest: 500 });
  assert.deepEqual(feeSplit(7, 10_000), { fee: 7, rest: 0 });
});

test("feeSplit: exact conservation", () => {
  for (const amount of [0, 1, 2, 499, 500, 501, 1234, 99_999, 10_000_000]) {
    for (const bps of [0, 1, 333, 1000, 2000, 9999, 10_000]) {
      const { fee, rest } = feeSplit(amount, bps);
      assert.equal(fee + rest, amount, `${amount} @ ${bps}`);
      assert.ok(Number.isInteger(fee) && fee >= 0);
    }
  }
});

test("feeSplit: invalid input throws", () => {
  for (const bps of [-1, 10_001, 0.5, Number.NaN]) assert.throws(() => feeSplit(100, bps), RangeError, String(bps));
  for (const amount of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) assert.throws(() => feeSplit(amount), RangeError, String(amount));
});

test("parseDollars / fromCents", () => {
  assert.equal(parseDollars("12.5"), 1250);
  assert.equal(parseDollars("9"), 900);
  assert.equal(parseDollars(" 0.01 "), 1);
  assert.equal(parseDollars("5.000"), 500);
  for (const bad of ["", "-1", "1e3", "1.005", "abc", "1."]) assert.throws(() => parseDollars(bad), RangeError, bad);
  assert.equal(fromCents(1250), "12.5");
  assert.equal(fromCents(900), "9");
  assert.equal(fromCents(1), "0.01");
  assert.equal(fromCents(-150), "-1.5");
  for (const c of [0, 1, 99, 100, 101, 123_456]) assert.equal(parseDollars(fromCents(c)), c);
});

test("dollarsToCents rounds float noise only", () => {
  assert.equal(dollarsToCents(9), 900);
  assert.equal(dollarsToCents(19.99), 1999);
  assert.equal(dollarsToCents(0.1 + 0.2), 30);
  assert.throws(() => dollarsToCents(1.005), RangeError);
  assert.throws(() => dollarsToCents(-1), RangeError);
  assert.throws(() => dollarsToCents(Number.NaN), RangeError);
  assert.equal(centsToDollars(1999), 19.99);
});

test("isCents and formatCents", () => {
  assert.ok(isCents(0) && isCents(500));
  assert.ok(!isCents(-1) && !isCents(1.5) && !isCents("500"));
  assert.equal(formatCents(900), "$9.00");
  assert.equal(formatCents(123_456), "$1,234.56");
});
