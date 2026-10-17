import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { AGENT_ID_RE, isAgentId, slugProblem, versionProblem } from "../src/runtime/agent-ids.js";
import { agentIsAvailable, assertAgentAvailable, PLATFORM_ACTIVE, PLATFORM_SUSPENDED } from "../src/runtime/availability.js";
import { canUseMemory } from "../src/runtime/memory-access.js";
import { HttpError } from "../src/lib/http.js";

// Platform kill switch, memory access and id format (PACKAGE_SPEC.md 11.2, 15.4 and P0). Pure: no database.

describe("availability: platform suspension", () => {
  it("serves and sells only while active", () => {
    assert.equal(agentIsAvailable({ platformStatus: PLATFORM_ACTIVE }), true);
    assert.equal(agentIsAvailable({ platformStatus: PLATFORM_SUSPENDED }), false);
    assert.equal(agentIsAvailable({ platformStatus: "anything-else" }), false);
  });

  it("assertAgentAvailable: 403 agent_unavailable when suspended", () => {
    assert.doesNotThrow(() => assertAgentAvailable({ platformStatus: "active" }));
    assert.throws(
      () => assertAgentAvailable({ platformStatus: "suspended" }),
      (e: unknown) => e instanceof HttpError && e.status === 403 && e.code === "agent_unavailable",
    );
  });
});

describe("memory: only with a license or an open session", () => {
  it("access rule", () => {
    assert.equal(canUseMemory({ licensed: false, openSession: false }), false);
    assert.equal(canUseMemory({ licensed: true, openSession: false }), true);
    assert.equal(canUseMemory({ licensed: false, openSession: true }), true);
    assert.equal(canUseMemory({ licensed: true, openSession: true }), true);
  });
});

describe("ids and slugs", () => {
  it("isAgentId: 32 lowercase hex", () => {
    assert.equal(isAgentId("0123456789abcdef0123456789abcdef"), true);
    assert.equal(isAgentId("0123456789ABCDEF0123456789abcdef"), false);
    assert.equal(isAgentId("frontend-react"), false);
    assert.equal(isAgentId("0123456789abcdef0123456789abcde"), false);
    assert.equal(AGENT_ID_RE.test("g123456789abcdef0123456789abcdef"), false);
  });

  it("slugProblem explains the reason", () => {
    assert.equal(slugProblem("frontend-react"), null);
    assert.match(slugProblem("0123456789abcdef0123456789abcdef")!, /format of an id/);
    assert.match(slugProblem("Ab")!, /3 to 40/);
    assert.match(slugProblem("With Space")!, /lowercase/);
  });

  it("versionProblem: numeric, no pre-release, up to 16 bytes", () => {
    assert.equal(versionProblem("1.2.3"), null);
    assert.match(versionProblem("1.2")!, /MAJOR\.MINOR\.PATCH/);
    assert.match(versionProblem("1.2.3-rc1")!, /MAJOR\.MINOR\.PATCH/);
    assert.match(versionProblem("1234567.1234567.12345")!, /16 bytes/);
  });
});
