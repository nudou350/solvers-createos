import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { evalLabel } from "../src/mcp/agent-text.js";

// Connector texts shared by the MCP tools. Pure rules, no database.

describe("performance score label (P5)", () => {
  it("no score: no ratings yet, never 0% nor verified", () => {
    assert.equal(evalLabel(0), "performance: no ratings yet");
    assert.doesNotMatch(evalLabel(0), /0%|verified/i);
  });
  it("with a score: internal team test, never verified", () => {
    assert.equal(evalLabel(8250), "internal team test (automated checks): 83%");
    assert.doesNotMatch(evalLabel(8250), /verified/i);
  });
});
