import { randomBytes } from "node:crypto";
import {
  canTransition,
  nextActionFor,
  reviewChecklistComplete,
  SUBMISSION_OPEN_STATUSES,
  type AdminSubmissionRow,
  type SubmissionStatus,
  type SubmissionView,
  type ValidationReport,
} from "@solvers/shared";
import { isAdminIn } from "../publish/admin-rules.js";
import { relativePathProblem } from "../runtime/package-paths.js";
import { formatCents, MIN_PRICE_CENTS } from "../runtime/price.js";
import type { ZipIssue } from "./zip.js";

// Pure rules of package submission and review (PACKAGE_SPEC.md 14). No database, disk or network: tested in
// test/submission-rules.test.ts. The handlers (upload, worker, review) only orchestrate.

// ---------------------------------------------------------------------------------------------------------------
// Administrators

/** Is the user id listed in `ADMIN_USER_IDS` (comma separated)? */
export const isAdminUser = (userId: string | undefined, list: string): boolean => isAdminIn(userId, list);

// ---------------------------------------------------------------------------------------------------------------
// Invites

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I: the code goes by e-mail and is typed

/** Readable invite code, e.g. `SLV-7KQ2-M9XD-4TPA` (12 characters of 32 symbols: ~60 bits). */
export function generateInviteCode(bytes: Uint8Array = randomBytes(12)): string {
  const chars = Array.from(bytes.slice(0, 12), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]!).join("");
  return `SLV-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

/** What the creator typed becomes the database key: uppercase, no spaces. */
export const normalizeInviteCode = (raw: string): string => raw.trim().toUpperCase().replace(/\s+/g, "");

// ---------------------------------------------------------------------------------------------------------------
// Who can submit and how many

export type CreatorGate = { invited: boolean; termsAcceptedAt: Date | null } | undefined;

/** Why the creator cannot submit a package yet, or null. */
export function creatorNotReady(c: CreatorGate): string | null {
  if (!c) return "Complete your creator profile before submitting a package.";
  if (!c.invited) return "Submitting packages is for invited creators only.";
  if (!c.termsAcceptedAt) return "Accept the creator terms before submitting a package.";
  return null;
}

export type UploadLimits = { maxPending: number; maxPerDay: number };

/** 429 when the creator already has too many pending submissions or submitted too many in the last 24 h. */
export function uploadLimitProblem(counts: { pending: number; last24h: number }, limits: UploadLimits): { code: string; message: string } | null {
  if (counts.pending >= limits.maxPending) {
    return { code: "too_many_pending", message: `You already have ${counts.pending} submission(s) in progress (limit: ${limits.maxPending}). Wait for the review before submitting another.` };
  }
  if (counts.last24h >= limits.maxPerDay) {
    return { code: "too_many_per_day", message: `Daily limit of ${limits.maxPerDay} submissions reached. Try again tomorrow.` };
  }
  return null;
}

export const isOpenStatus = (s: string): boolean => (SUBMISSION_OPEN_STATUSES as readonly string[]).includes(s);

/** Only a submission with requested changes accepts a new ZIP in the same submission. */
export const canResubmit = (status: string): boolean => status === "changes_requested";

// ---------------------------------------------------------------------------------------------------------------
// Validation report (what goes to the creator and to the reviewer)

type Issue = { code: string; path?: string; message: string; fix?: string };

/** Report with the same shape as the validator's output, built from the ZIP extractor's errors. */
export function reportFromZip(errors: ZipIssue[], warnings: ZipIssue[] = []): ValidationReport {
  return { ok: false, errors: errors.map(toIssue), warnings: warnings.map(toIssue), stats: { files: 0 } };
}

const toIssue = (i: ZipIssue | Issue): Issue => ({ code: i.code, path: i.path, message: i.message, fix: i.fix });

/** Merges the extractor's warnings (junk removed) into the validator's, without repeating the same code and path. */
export function mergeWarnings(validator: Issue[], zip: ZipIssue[]): Issue[] {
  const seen = new Set(validator.map((w) => `${w.code}|${w.path ?? ""}`));
  return [...validator, ...zip.filter((w) => !seen.has(`${w.code}|${w.path}`)).map(toIssue)];
}

export function countIssues(validation: unknown): { errors: number; warnings: number } {
  const v = validation as { errors?: unknown[]; warnings?: unknown[] } | null;
  return { errors: v?.errors?.length ?? 0, warnings: v?.warnings?.length ?? 0 };
}

// ---------------------------------------------------------------------------------------------------------------
// Manifest at submission

/**
 * The server is the authority of `id` and `creator.id` (PACKAGE_SPEC.md 4.1): `id` is assigned on the first version and
 * `creator.id` is always overwritten by the profile id. The creator's name and bio stay the manifest's (the storefront uses the profile).
 */
export function normalizeManifest(raw: Record<string, unknown>, ids: { agentId: string; creatorId: string }): Record<string, unknown> {
  const creator = raw.creator && typeof raw.creator === "object" && !Array.isArray(raw.creator) ? (raw.creator as Record<string, unknown>) : {};
  return { ...raw, id: ids.agentId, creator: { ...creator, id: ids.creatorId } };
}

/** `slug`, `version` and `name` enter the submission row only when their format is safe (even when rejected, it helps find the submission). */
export function safeManifestFields(raw: unknown): { slug?: string; version?: string; name?: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const m = raw as Record<string, unknown>;
  const out: { slug?: string; version?: string; name?: string } = {};
  if (typeof m.slug === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.slug) && m.slug.length <= 40) out.slug = m.slug;
  if (typeof m.version === "string" && /^\d+\.\d+\.\d+$/.test(m.version) && m.version.length <= 16) out.version = m.version;
  if (typeof m.name === "string" && m.name.trim()) out.name = m.name.slice(0, 80);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Approval

export type Approved = { versionHash: string; priceCents: number; name: string; version: string };

/** Is `a` an X.Y.Z version strictly greater than `b`? An invalid format is never greater. */
export function versionGreater(a: string, b: string): boolean {
  const parse = (v: string) => (/^\d+\.\d+\.\d+$/.test(v) ? v.split(".").map(Number) : null);
  const x = parse(a);
  const y = parse(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) if (x[i]! !== y[i]!) return x[i]! > y[i]!;
  return false;
}

export type ApprovalPlan = { ok: true; approved: Approved } | { ok: false; status: number; code: string; message: string };

/**
 * Checks what the approval will freeze: an integer price in USD cents >= the platform minimum. The price comes from the
 * SUBMITTED MANIFEST (never from the admin's request body) and the hash from the extracted folder, computed by the caller.
 */
export function planApproval(args: {
  status: string;
  validation: unknown;
  manifest: Record<string, unknown> | null;
  checklist: Record<string, boolean>;
  versionHash: string;
  minPriceCents?: number;
}): ApprovalPlan {
  const fail = (status: number, code: string, message: string): ApprovalPlan => ({ ok: false, status, code, message });
  if (reviewTransitionProblem(args.status, "approve")) {
    return fail(409, "invalid_state", `You can't approve a submission in "${args.status}".`);
  }
  if (!(args.validation as ValidationReport | null)?.ok) return fail(409, "validation_failed", "The validator did not approve this package.");
  if (!reviewChecklistComplete(args.checklist)) return fail(400, "checklist_incomplete", "Check every item on the review checklist to approve.");
  const m = args.manifest;
  if (!m) return fail(409, "no_manifest", "The submission has no manifest.");
  const cents = ((m.pricing ?? {}) as { priceCents?: unknown }).priceCents;
  if (typeof cents !== "number" || !Number.isSafeInteger(cents) || cents <= 0) return fail(400, "price_invalid", "The manifest price (pricing.priceCents) must be a whole number of US cents.");
  const min = args.minPriceCents ?? MIN_PRICE_CENTS;
  if (cents < min) return fail(400, "price_below_min", `The price is below the platform minimum (${formatCents(min)}).`);
  if (typeof m.name !== "string" || typeof m.version !== "string") return fail(409, "no_manifest", "The manifest has no valid name and version.");
  return { ok: true, approved: { versionHash: args.versionHash, priceCents: cents, name: m.name, version: m.version } };
}

/** Reviewer action that changes the state: where it goes and from which states. Every action respects `canTransition` AND this list. */
export const REVIEW_TRANSITIONS = {
  // Approving starts the publication right away (publish/finalize.ts).
  approve: { to: "publishing", from: ["pending_review"] },
  request_changes: { to: "changes_requested", from: ["pending_review"] },
  reject: { to: "rejected", from: ["pending_review", "changes_requested"] },
  // The admin undoes an approval whose publication failed: back to `changes_requested` (note required).
  revoke: { to: "changes_requested", from: ["publish_failed"] },
} as const satisfies Record<string, { to: SubmissionStatus; from: readonly SubmissionStatus[] }>;

export function reviewTransitionProblem(from: string, action: keyof typeof REVIEW_TRANSITIONS): string | null {
  const rule = REVIEW_TRANSITIONS[action];
  const allowed = (rule.from as readonly string[]).includes(from) && canTransition(from as SubmissionStatus, rule.to);
  if (allowed) return null;
  const what = action === "approve" ? "approve" : action === "reject" ? "reject" : action === "revoke" ? "revoke the approval of" : "request changes on";
  return `You can't ${what} a submission in "${from}".`;
}

// ---------------------------------------------------------------------------------------------------------------
// Reviewer preview

/** Path asked by the review screen (`?path=`): relative, no `..`, inside the package. */
export function reviewPathProblem(path: unknown): string | null {
  if (typeof path !== "string") return "provide the file path";
  return relativePathProblem(path, [""]);
}

// ---------------------------------------------------------------------------------------------------------------
// Response shapes

type SubmissionRowLike = {
  id: string;
  agentId: string;
  slug: string;
  version: string;
  status: string;
  manifest: Record<string, unknown> | null;
  sizeBytes: number;
  validation: Record<string, unknown> | null;
  reviewerNotes: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Creator view: never exposes disk paths, the whole manifest nor internal review data. */
export function toSubmissionView(row: SubmissionRowLike): SubmissionView {
  const name = typeof row.manifest?.name === "string" ? row.manifest.name : null;
  return {
    id: row.id,
    agentId: row.agentId,
    slug: row.slug,
    version: row.version,
    status: row.status as SubmissionStatus,
    name,
    sizeBytes: row.sizeBytes,
    validation: (row.validation as ValidationReport | null) ?? null,
    reviewerNotes: row.reviewerNotes,
    nextAction: nextActionFor(row.status as SubmissionStatus),
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Creator columns of the admin rows: account, contact e-mail and profile name. */
export type AdminCreator = { userId: string; email: string | null; name: string | null };

export function toAdminRow(row: SubmissionRowLike, creator: AdminCreator, isNewAgent: boolean): AdminSubmissionRow {
  const { errors, warnings } = countIssues(row.validation);
  return {
    id: row.id,
    slug: row.slug,
    name: typeof row.manifest?.name === "string" ? row.manifest.name : null,
    version: row.version,
    creatorUserId: creator.userId,
    creatorEmail: creator.email,
    creatorName: creator.name,
    status: row.status as SubmissionStatus,
    isNewAgent,
    errors,
    warnings,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Queue row from the list's light columns (`listColumns`): name already truncated and counts already computed in the database. */
export function toAdminListRow(
  row: { id: string; slug: string; version: string; status: string; name: string | null; errorCount: number; warningCount: number; createdAt: Date; updatedAt: Date },
  creator: AdminCreator,
  isNewAgent: boolean,
): AdminSubmissionRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    version: row.version,
    creatorUserId: creator.userId,
    creatorEmail: creator.email,
    creatorName: creator.name,
    status: row.status as SubmissionStatus,
    isNewAgent,
    errors: row.errorCount,
    warnings: row.warningCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Declared vs. validator-proven differentiators (`stats.differentiators`). */
export function differentiatorsOf(manifest: Record<string, unknown> | null, validation: Record<string, unknown> | null): { declared: string[]; proven: string[] } {
  const declared = Array.isArray(manifest?.differentiators) ? (manifest.differentiators as unknown[]).filter((d): d is string => typeof d === "string") : [];
  const stats = (validation as { stats?: { differentiators?: unknown } } | null)?.stats;
  const proven = Array.isArray(stats?.differentiators) ? (stats.differentiators as unknown[]).filter((d): d is string => typeof d === "string") : [];
  return { declared, proven };
}
