import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { notListedBlock } from "../src/store/purchase-rules.js";

// Catalog guard before a Checkout Session is created (the license/creator checks live in payments/stripe-rules.ts). Pure rules, no database.

describe("notListedBlock", () => {
  it("sells only what is listed AND loadable", () => {
    assert.equal(notListedBlock({ listed: true, hasPackage: true }), null);
    assert.equal(notListedBlock({ listed: false, hasPackage: true })?.code, "agent_not_listed");
    assert.equal(notListedBlock({ listed: true, hasPackage: false })?.code, "agent_not_listed");
  });
});
