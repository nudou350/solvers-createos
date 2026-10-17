import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { canTransition, nextActionFor, SUBMISSION_STATUSES, type SubmissionStatus } from "@solvers/shared";
import {
  creatorNotReady,
  differentiatorsOf,
  generateInviteCode,
  isAdminUser,
  mergeWarnings,
  normalizeInviteCode,
  normalizeManifest,
  planApproval,
  reviewPathProblem,
  reviewTransitionProblem,
  safeManifestFields,
  toSubmissionView,
  uploadLimitProblem,
} from "../src/submissions/rules.js";

// Pure rules of submission and review (no database, network or disk).

const CHECKLIST = { promiseDelivered: true, twoDifferentiatorsProven: true, rightsAndSources: true, noHarmfulInstructions: true, priceTrialShowcaseCoherent: true };
const OK_VALIDATION = { ok: true, errors: [], warnings: [] };
const manifest = (pricing: Record<string, unknown> = { priceCents: 900 }) => ({ name: "Meu Solver", version: "1.0.0", pricing });
const plan = (over: Partial<Parameters<typeof planApproval>[0]> = {}) =>
  planApproval({ status: "pending_review", validation: OK_VALIDATION, manifest: manifest(), checklist: CHECKLIST, versionHash: "ab".repeat(32), ...over });

describe("review state machine", () => {
  it("only pending_review approves; pending_review and changes_requested reject; only pending_review requests changes", () => {
    for (const s of SUBMISSION_STATUSES) {
      assert.equal(reviewTransitionProblem(s, "approve") === null, s === "pending_review", `approve in ${s}`);
      assert.equal(reviewTransitionProblem(s, "request_changes") === null, s === "pending_review", `request_changes in ${s}`);
      assert.equal(reviewTransitionProblem(s, "reject") === null, s === "pending_review" || s === "changes_requested", `reject in ${s}`);
      assert.equal(reviewTransitionProblem(s, "revoke") === null, s === "publish_failed", `revoke in ${s}`);
    }
  });

  it("reviewer actions never bypass canTransition", () => {
    const from: SubmissionStatus = "pending_review";
    assert.ok(canTransition(from, "publishing"), "approving starts the publication");
    assert.ok(!canTransition("rejected", "publishing"));
    assert.ok(!canTransition("publishing", "pending_review"), "approved does not go back to review");
    assert.ok(canTransition("publish_failed", "publishing"), "retrying publication exists, but it is not an approval");
    assert.ok(reviewTransitionProblem("publish_failed", "approve"));
  });

  it("resubmission only works in changes_requested and leads to validating", () => {
    assert.ok(canTransition("changes_requested", "validating"));
    assert.ok(!canTransition("rejected_validation", "validating"), "rejected by the validator: no resubmission on the same submission");
    assert.ok(!canTransition("rejected", "validating"));
  });

  it("the creator's next step follows the state", () => {
    assert.equal(nextActionFor("changes_requested"), "fix_and_resubmit");
    assert.equal(nextActionFor("publishing"), "wait_publish");
    assert.equal(nextActionFor("pending_review"), "wait_review");
  });
});

describe("planApproval", () => {
  it("approves and freezes the hash, the price in cents, name and version", () => {
    const p = plan();
    assert.ok(p.ok);
    if (!p.ok) return;
    assert.deepEqual(p.approved, { versionHash: "ab".repeat(32), priceCents: 900, name: "Meu Solver", version: "1.0.0" });
  });

  it("refuses a wrong state, a failed validation and an incomplete checklist", () => {
    assert.deepEqual([plan({ status: "published" }).ok, (plan({ status: "published" }) as { code: string }).code], [false, "invalid_state"]);
    assert.equal((plan({ validation: { ok: false, errors: [{}], warnings: [] } }) as { code: string }).code, "validation_failed");
    assert.equal((plan({ validation: null }) as { code: string }).code, "validation_failed");
    assert.equal((plan({ checklist: { ...CHECKLIST, rightsAndSources: false } }) as { code: string }).code, "checklist_incomplete");
    assert.equal((plan({ checklist: {} }) as { code: string }).code, "checklist_incomplete");
  });

  it("price: whole cents, at least the minimum price ($5.00)", () => {
    assert.ok(plan({ manifest: manifest({ priceCents: 500 }) }).ok, "exactly the minimum passes");
    assert.equal((plan({ manifest: manifest({ priceCents: 499 }) }) as { code: string }).code, "price_below_min");
    assert.equal((plan({ manifest: manifest({ priceCents: 0 }) }) as { code: string }).code, "price_invalid");
    assert.equal((plan({ manifest: manifest({ priceCents: -900 }) }) as { code: string }).code, "price_invalid");
    assert.equal((plan({ manifest: manifest({ priceCents: "900" }) }) as { code: string }).code, "price_invalid");
    assert.equal((plan({ manifest: manifest({ priceCents: 900.5 }) }) as { code: string }).code, "price_invalid");
    assert.equal((plan({ manifest: manifest({ priceCents: Number.NaN }) }) as { code: string }).code, "price_invalid");
    assert.equal((plan({ manifest: manifest({ price: 9 }) }) as { code: string }).code, "price_invalid", "only priceCents counts");
    assert.equal((plan({ minPriceCents: 1200 }) as { code: string }).code, "price_below_min", "a higher minimum applies");
  });

  it("no manifest, no approval", () => {
    assert.equal((plan({ manifest: null }) as { code: string }).code, "no_manifest");
  });
});

describe("admins", () => {
  it("ADMIN_USER_IDS splits on commas and ignores spaces and empty entries", () => {
    assert.ok(isAdminUser("b", " a , b,, c "));
    assert.ok(isAdminUser("B", "a,b"), "uuids compare lowercase");
    assert.ok(!isAdminUser(undefined, "a,b"));
    assert.ok(!isAdminUser("a", ""), "empty list = nobody is admin");
  });
});

describe("invites", () => {
  it("generates readable, unique codes without ambiguous characters", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateInviteCode()));
    assert.equal(codes.size, 200);
    for (const c of codes) assert.match(c, /^SLV-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it("what the creator types becomes the database key", () => {
    assert.equal(normalizeInviteCode("  slv-abcd-efgh-2345 "), "SLV-ABCD-EFGH-2345");
    assert.equal(normalizeInviteCode("slv abcd"), "SLVABCD");
  });
});

describe("upload limits", () => {
  const limits = { maxPending: 3, maxPerDay: 5 };
  it("pending submissions and uploads per day", () => {
    assert.equal(uploadLimitProblem({ pending: 2, last24h: 4 }, limits), null);
    assert.equal(uploadLimitProblem({ pending: 3, last24h: 3 }, limits)?.code, "too_many_pending");
    assert.equal(uploadLimitProblem({ pending: 0, last24h: 5 }, limits)?.code, "too_many_per_day");
  });

  it("only an invited creator with a profile and accepted terms can upload", () => {
    assert.ok(creatorNotReady(undefined));
    assert.ok(creatorNotReady({ invited: false, termsAcceptedAt: new Date() }));
    assert.ok(creatorNotReady({ invited: true, termsAcceptedAt: null }));
    assert.equal(creatorNotReady({ invited: true, termsAcceptedAt: new Date() }), null);
  });
});

describe("manifest on upload", () => {
  it("the server overwrites id and creator.id and keeps the rest", () => {
    const out = normalizeManifest({ slug: "x", id: "0".repeat(32), creator: { id: "falso", name: "A", bio: "B" } }, { agentId: "a".repeat(32), creatorId: "cr_1" }) as { id: string; creator: Record<string, string>; slug: string };
    assert.equal(out.id, "a".repeat(32));
    assert.deepEqual(out.creator, { id: "cr_1", name: "A", bio: "B" });
    assert.equal(out.slug, "x");
    assert.deepEqual((normalizeManifest({}, { agentId: "a".repeat(32), creatorId: "cr_1" }) as { creator: unknown }).creator, { id: "cr_1" });
  });

  it("slug, version and name only enter the row with a safe format", () => {
    assert.deepEqual(safeManifestFields({ slug: "meu-solver", version: "1.2.3", name: "Nome" }), { slug: "meu-solver", version: "1.2.3", name: "Nome" });
    assert.deepEqual(safeManifestFields({ slug: "../../x", version: "1.0", name: "  " }), {});
    assert.deepEqual(safeManifestFields({ slug: "a".repeat(41), version: "1.0.0-beta" }), {});
    assert.deepEqual(safeManifestFields(null), {});
    assert.deepEqual(safeManifestFields([]), {});
  });

  it("a path requested by the review screen does not leave the package", () => {
    assert.equal(reviewPathProblem("steps/01.md"), null);
    for (const bad of ["../x", "/etc/passwd", "a\\b", "a/../b", "", undefined, "a\u0000b", "C:/x"]) assert.ok(reviewPathProblem(bad), String(bad));
  });
});

describe("views", () => {
  const row = {
    id: "a".repeat(24),
    agentId: "b".repeat(32),
    slug: "s",
    version: "1.0.0",
    status: "changes_requested",
    manifest: { name: "Nome" },
    sizeBytes: 10,
    validation: { ok: true, errors: [], warnings: [] },
    reviewerNotes: "ajuste X",
    error: null,
    createdAt: new Date("2026-10-02T10:00:00Z"),
    updatedAt: new Date("2026-10-02T11:00:00Z"),
  };
  it("the creator's view has neither disk paths nor the manifest", () => {
    const v = toSubmissionView({ ...row, zipPath: "C:/segredo/a.zip" } as typeof row);
    assert.equal(v.name, "Nome");
    assert.equal(v.nextAction, "fix_and_resubmit");
    assert.ok(!JSON.stringify(v).includes("segredo"));
    assert.ok(!("manifest" in v) && !("zipPath" in v));
  });

  it("declared × proven differentiators", () => {
    assert.deepEqual(differentiatorsOf({ differentiators: ["memory", "tool", 5] }, { stats: { differentiators: ["memory"] } }), { declared: ["memory", "tool"], proven: ["memory"] });
    assert.deepEqual(differentiatorsOf(null, null), { declared: [], proven: [] });
  });

  it("merges the extractor's warnings without duplicates", () => {
    const merged = mergeWarnings([{ code: "ZIP_IGNORED_FILE", path: "a", message: "m" }], [{ code: "ZIP_IGNORED_FILE", path: "a", message: "m", fix: "f" }, { code: "ZIP_IGNORED_FILE", path: "b", message: "m", fix: "f" }]);
    assert.deepEqual(merged.map((w) => w.path), ["a", "b"]);
  });
});

describe("texts for the creator come out in English", () => {
  it("who cannot upload yet", () => {
    assert.match(creatorNotReady(undefined) ?? "", /^Complete your creator profile/);
    assert.match(creatorNotReady({ invited: false, termsAcceptedAt: null }) ?? "", /invited creators only/);
    assert.match(creatorNotReady({ invited: true, termsAcceptedAt: null }) ?? "", /Accept the creator terms/);
  });
  it("upload limits and review transitions", () => {
    assert.match(uploadLimitProblem({ pending: 3, last24h: 0 }, { maxPending: 3, maxPerDay: 10 })?.message ?? "", /already have 3 submission/);
    assert.match(uploadLimitProblem({ pending: 0, last24h: 10 }, { maxPending: 3, maxPerDay: 10 })?.message ?? "", /Daily limit of 10/);
    assert.equal(reviewTransitionProblem("published", "approve"), `You can't approve a submission in "published".`);
    assert.equal(reviewTransitionProblem("published", "request_changes"), `You can't request changes on a submission in "published".`);
  });
});
