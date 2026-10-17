import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@solvers/api-client";
import { boughtPath, checkoutFailure, isCheckoutUrl, param, resumeBuyPath } from "../src/components/checkout/rules";

test("param: first value, trimmed, null when empty", () => {
  assert.equal(param(" abc "), "abc");
  assert.equal(param(["x", "y"]), "x");
  assert.equal(param(""), null);
  assert.equal(param(undefined), null);
});

test("a failed checkout: 401 signs in first, 409 means already owned, anything else is shown", () => {
  assert.equal(checkoutFailure(new ApiError(401, "unauthorized", "x", {})), "login");
  assert.equal(checkoutFailure(new ApiError(409, "already_owned", "x", {})), "owned");
  assert.equal(checkoutFailure(new ApiError(400, "already_owned", "x", {})), "owned");
  assert.equal(checkoutFailure(new ApiError(503, "checkout_unavailable", "x", {})), "error");
  assert.equal(checkoutFailure(new TypeError("Failed to fetch")), "error");
});

test("return paths: resume on the Solver page, success banner in the library", () => {
  assert.equal(resumeBuyPath("pdf tools"), "/solvers/pdf%20tools?buy=1");
  assert.equal(boughtPath("pdf-tools"), "/library?bought=pdf-tools");
});

test("only Stripe's hosted page or this site is followed", () => {
  const site = "http://localhost:3041";
  assert.ok(isCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_123", site));
  assert.ok(isCheckoutUrl("/library?bought=x", site));
  assert.ok(isCheckoutUrl("http://localhost:3041/library", site));
  assert.ok(!isCheckoutUrl("http://checkout.stripe.com/c/pay", site));
  assert.ok(!isCheckoutUrl("https://stripe.com.evil.example/pay", site));
  assert.ok(!isCheckoutUrl("javascript:alert(1)", site));
  assert.ok(!isCheckoutUrl(42, site));
});
