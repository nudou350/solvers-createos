import "./helpers/fake-env.js";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { PublicConfig } from "@solvers/shared";

// Store pieces that need no database: the public config and the eval score shown in the catalog.

describe("publicConfig", () => {
  it("prices in USD cents and nothing but what the web needs", async () => {
    const { publicConfig } = await import("../src/store/public-config.js");
    const c = PublicConfig.parse(publicConfig());
    assert.equal(c.currency, "usd");
    assert.equal(c.minPriceCents, 500);
    assert.ok(c.connectorUrl.endsWith("/mcp"));
    assert.deepEqual(Object.keys(publicConfig()).sort(), ["connectorUrl", "currency", "devLogin", "feeBps", "freeTrialUses", "minPriceCents", "stripePublishableKey"]);
  });
});

describe("currentEvalBps (D6)", () => {
  it("no measured version on record = not measured (0); a measurement of another version = 0", async () => {
    const { currentEvalBps } = await import("../src/store/mappers.js");
    const v = "ab".repeat(32);
    assert.equal(currentEvalBps({ evalScoreBps: 8000, evalVersionHash: null, versionHash: v }), 0);
    assert.equal(currentEvalBps({ evalScoreBps: 8000, evalVersionHash: v, versionHash: v.toUpperCase() }), 8000);
    assert.equal(currentEvalBps({ evalScoreBps: 8000, evalVersionHash: "cd".repeat(32), versionHash: v }), 0);
  });
});
