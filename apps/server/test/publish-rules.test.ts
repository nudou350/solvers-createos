import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { isAdminIn, parseAdminUserIds } from "../src/publish/admin-rules.js";
import { FINALIZABLE_STATUSES, parseApproved, type ApprovedRecord } from "../src/publish/approval-rules.js";
import { CliUsageError, parseSuspendArgs } from "../src/publish/cli-args.js";

// Pure publication rules (PACKAGE_SPEC.md 15): the approved record, site admins and the cli:suspend arguments.

const H1 = "a".repeat(64);
const approved = (over: Partial<ApprovedRecord> = {}): ApprovedRecord => ({ versionHash: H1, priceCents: 1900, name: "My Solver", version: "1.0.0", ...over });

describe("parseApproved: the approved record is trusted only with the right shape", () => {
  it("accepts the approval record and refuses malformed ones", () => {
    assert.deepEqual(parseApproved(approved()), approved());
    assert.deepEqual(parseApproved({ ...approved(), extra: 1 }), approved(), "unknown fields are dropped");
    assert.equal(parseApproved(null), null);
    assert.equal(parseApproved({ ...approved(), versionHash: "abc" }), null);
    assert.equal(parseApproved({ ...approved(), versionHash: `0x${H1}` }), null);
    assert.equal(parseApproved({ ...approved(), priceCents: 12.5 }), null);
    assert.equal(parseApproved({ ...approved(), priceCents: -1 }), null);
    assert.equal(parseApproved({ ...approved(), priceCents: "1900" }), null);
    assert.equal(parseApproved({ ...approved(), name: "" }), null);
  });
  it("finalization resumes from publishing or a failed publication only", () => {
    assert.deepEqual([...FINALIZABLE_STATUSES], ["publishing", "publish_failed"]);
  });
});

describe("site admins (ADMIN_USER_IDS)", () => {
  const A = "3f2b1c4e-0000-4000-8000-00000000000a";
  const B = "3f2b1c4e-0000-4000-8000-00000000000b";
  it("comma list, spaces and empty entries; compared lowercase", () => {
    assert.deepEqual([...parseAdminUserIds(` ${A.toUpperCase()} , ${B},, `)], [A, B]);
    assert.equal(isAdminIn(B.toUpperCase(), `${A},${B}`), true);
    assert.equal(isAdminIn("someone-else", `${A},${B}`), false);
    assert.equal(isAdminIn(A, ""), false);
    assert.equal(isAdminIn(undefined, A), false);
  });
});

describe("cli:suspend arguments", () => {
  it("slug, --resume, --reason, --actor", () => {
    assert.deepEqual(parseSuspendArgs(["my-solver"]), { ref: "my-solver", resume: false, reason: null, actor: null });
    assert.equal(parseSuspendArgs(["my-solver", "--resume"]).resume, true);
    assert.equal(parseSuspendArgs(["x", "--reason", "copied content"]).reason, "copied content");
    assert.equal(parseSuspendArgs(["x", "--actor", "u1"]).actor, "u1");
    assert.throws(() => parseSuspendArgs([]), CliUsageError);
    assert.throws(() => parseSuspendArgs(["a", "b"]), CliUsageError);
    assert.throws(() => parseSuspendArgs(["x", "--reason"]), CliUsageError);
    assert.throws(() => parseSuspendArgs(["x", "--key-file", "k"]), CliUsageError);
  });
});
