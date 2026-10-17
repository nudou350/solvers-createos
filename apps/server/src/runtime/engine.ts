import { and, desc, eq, gt, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, schema } from "../db/index.js";
import { forbidden, notFound } from "../lib/http.js";
import { randomId, sha256Hex } from "../lib/crypto.js";
import type { SolverPackage } from "./packages.js";
import type { VerifyResult } from "@solvers/shared";
import { runStepVerify } from "../sandbox/verify.js";
import { paidAccessById, sessionGrantValid, type PaidAccess, type PlatformAccess } from "./access.js";
import { assertAgentCanServe, type AccessKind } from "./availability.js";
import { withSummary } from "./session-rules.js";
import { declaredTemplates, templatesOverview } from "./templates.js";

// Step engine (INSTRUCTIONS.md 5.4): one session per activation, one step at a time, gates,
// sandbox-proven gates (`steps[].verify`) and a simple per-user watermark.

export type Session = typeof schema.sessions.$inferSelect;

/** Free trial: short session with a call cap (prevents downloading the whole knowledge base for free). */
const TRIAL_TTL_MS = 2 * 3600_000;
const PAID_TTL_MS = 24 * 3600_000;
export const TRIAL_MAX_CALLS = 60;

/** Session access: free trial, paid (license) or platform Solver (free). */
export type SessionGrant = { kind: "trial" } | PaidAccess | PlatformAccess;

export async function createSession(userId: string, pkg: SolverPackage, grant: SessionGrant): Promise<Session> {
  const ttl = grant.kind === "trial" ? TRIAL_TTL_MS : PAID_TTL_MS;
  const [s] = await db
    .insert(schema.sessions)
    .values({
      id: `ses_${randomId(12)}`,
      userId,
      agentId: pkg.manifest.id,
      version: pkg.manifest.version,
      stepIndex: 0,
      access: grant.kind,
      licenseId: grant.kind === "license" ? grant.licenseId : null,
      context: { summaries: [] },
      expiresAt: new Date(Date.now() + ttl),
    })
    .returning();
  return s!;
}

/** A still-open session for the same user and solver: reused without charging another use. */
export async function findOpenSession(userId: string, agentId: string, version: string, totalSteps: number): Promise<Session | null> {
  const [s] = await db
    .select()
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, userId),
        eq(schema.sessions.agentId, agentId),
        eq(schema.sessions.version, version),
        gt(schema.sessions.expiresAt, new Date()),
        sql`${schema.sessions.stepIndex} <= ${totalSteps}`,
      ),
    )
    .orderBy(desc(schema.sessions.createdAt))
    .limit(1);
  return s ?? null;
}

/**
 * Trial session of a user who now has paid access (bought the license):
 * it becomes a paid session, with no limits and the paid TTL, keeping the step where the user stopped.
 */
export async function promoteSession(session: Session, paid: PaidAccess): Promise<Session> {
  const [s] = await db
    .update(schema.sessions)
    .set({
      access: paid.kind,
      licenseId: paid.licenseId,
      expiresAt: new Date(Date.now() + PAID_TTL_MS),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.sessions.id, session.id), eq(schema.sessions.access, "trial")))
    .returning();
  if (s) return s;
  // Another call promoted it first: return the current state.
  const [cur] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, session.id));
  return cur ?? session;
}

/** Ends the session (license revoked): the next activation opens a new one. */
export async function expireSession(sessionId: string): Promise<void> {
  await db.update(schema.sessions).set({ expiresAt: new Date(), updatedAt: new Date() }).where(eq(schema.sessions.id, sessionId));
}

/**
 * Loads the session, ensuring it belongs to the token's user, the specialist is not suspended, it has not expired, the free
 * trial has not exceeded its cap and the license (if any) is still valid.
 */
export async function getSession(sessionId: string, userId: string): Promise<Session> {
  const [s] = await db
    .update(schema.sessions)
    .set({ calls: sql`${schema.sessions.calls} + 1` })
    .where(and(eq(schema.sessions.id, sessionId), eq(schema.sessions.userId, userId)))
    .returning();
  if (!s) {
    const [other] = await db.select({ id: schema.sessions.id }).from(schema.sessions).where(eq(schema.sessions.id, sessionId));
    if (other) throw forbidden("This session belongs to another account.");
    throw notFound("Session not found. Activate the solver again with activate_solver.");
  }
  // Kill switch (PACKAGE_SPEC.md 15.4): a suspended specialist drops open sessions immediately.
  const [agent] = await db
    .select({ platformStatus: schema.agents.platformStatus })
    .from(schema.agents)
    .where(eq(schema.agents.id, s.agentId));
  const availability = agent ?? { platformStatus: "suspended" };
  assertAgentCanServe(availability, s.access as AccessKind);
  if (s.expiresAt < new Date()) throw forbidden("Session expired. Activate the solver again with activate_solver.");
  if (s.access === "trial" && s.calls > TRIAL_MAX_CALLS) {
    // Only at the moment of blocking: someone who bought during the trial continues in the same session, with no limits.
    const paid = await paidAccessById(userId, s.agentId);
    if (paid) return promoteSession(s, paid);
    throw forbidden("Free trial limit reached in this session. To continue, the user can buy the specialist.");
  }
  if (s.access === "license" && !(await sessionGrantValid(s))) {
    throw forbidden("This specialist's license is no longer active for this account.");
  }
  return s;
}

export async function advance(session: Session, resultSummary?: string): Promise<Session> {
  // The received summary belongs to the step before the one being delivered (slot stepIndex - 1).
  const context = withSummary(session.context as Record<string, unknown>, resultSummary ? session.stepIndex - 1 : -1, resultSummary ?? "");
  const [s] = await db
    .update(schema.sessions)
    .set({ stepIndex: session.stepIndex + 1, context, updatedAt: new Date() })
    .where(and(eq(schema.sessions.id, session.id), eq(schema.sessions.stepIndex, session.stepIndex)))
    .returning();
  // Another call advanced first: return the current state without skipping a step.
  return s ?? (await getSession(session.id, session.userId));
}

/** Step resubmission (repeated next_step): only stores the summary in the right slot, without advancing the session. */
export async function saveSummary(session: Session, slot: number, summary: string): Promise<Session> {
  const context = withSummary(session.context as Record<string, unknown>, slot, summary);
  const [s] = await db.update(schema.sessions).set({ context, updatedAt: new Date() }).where(eq(schema.sessions.id, session.id)).returning();
  return s ?? session;
}

const WATERMARKS = [
  "Follow the solver's method in order and confirm each checklist item before moving on.",
  "Complete this step's checklist before moving on to the next one.",
  "Before moving on, check every item on this step's checklist.",
  "Only go to the next step after you have validated the checklist below.",
  "Confirm this step's checklist; it is the criterion for moving on.",
  "Validate each checklist item with the user before continuing.",
  "The checklist below defines when this step is done.",
  "Use the checklist that follows as the condition for moving to the next step.",
];

/**
 * Control phrase chosen by the user id hash (1 of 8 = 3 bits). It serves as a HINT of a leak's origin,
 * not as proof or individual tracking (PACKAGE_SPEC.md 6.5): many users map to the same phrase.
 */
export function watermark(userId: string, agentId: string): string {
  const n = createHash("sha256").update(`${userId}:${agentId}`).digest().readUInt32BE(0);
  return WATERMARKS[n % WATERMARKS.length]!;
}

/** Solver overview. In a trial session, the listed templates are only those in `trial.templates`. */
export function overview(pkg: SolverPackage, trial: { templates: string[] } | null = null): string {
  const m = pkg.manifest;
  const steps = pkg.steps.map((s, i) => `${i + 1}. ${s.title}`).join("\n");
  const tools = m.tools.length ? m.tools.map((t) => `- ${t.name}: ${t.description}`).join("\n") : "- (none)";
  return [
    `# ${m.name} v${m.version}`,
    m.tagline,
    "",
    "## Method steps",
    steps,
    "",
    "## Available server tools (use with run_tool)",
    tools,
    ...templatesOverview(declaredTemplates(m), trial),
  ].join("\n");
}

export function renderStep(pkg: SolverPackage, session: Session, index: number): { text: string; done: boolean } {
  const total = pkg.steps.length;
  if (index >= total) {
    const text = [
      `# Wrap-up (${total}/${total} steps completed)`,
      "",
      "- Summarize for the user what was delivered and the decisions made.",
      "- If you learned lasting preferences of the user, save them with save_memory (no sensitive data).",
      "- Ask whether the user wants to rate the specialist in the store.",
      "- If something was out of scope, offer escalate_to_creator.",
    ].join("\n");
    return { text, done: true };
  }
  const step = pkg.steps[index]!;
  const gate = step.gate.length ? step.gate.map((g) => `- [ ] ${g}`).join("\n") : "- [ ] Step goal achieved";
  const proven = step.verify.length
    ? ["", `next_step runs these checks in the sandbox before advancing: ${step.verify.map((v) => `"${v.label}"`).join(", ")}. Make them pass with sandbox_run first.`]
    : [];
  const text = [
    `# Step ${index + 1} of ${total}: ${step.title}`,
    "",
    step.body.trim(),
    "",
    "## Exit checklist (gate)",
    watermark(session.userId, pkg.manifest.id),
    gate,
    ...proven,
    "",
    `When the checklist is complete, call next_step with session_id="${session.id}", completed_step=${index + 1} and result_summary in the format requested above.`,
  ].join("\n");
  return { text, done: false };
}

export const responseHash = (text: string) => sha256Hex(text);

/** Proof that a gate check passed in the sandbox (shown in the next_step response). */
export type StepProof = { label: string; exitCode: number; execMs: number };

export type StepVerifyOutcome = { passed: true; proofs: StepProof[] } | { passed: false; text: string };

/** Keeps the end of a long output: errors are usually at the bottom. */
const tail = (t: string, max = 2000) => (t.length > max ? `…${t.slice(-max)}` : t);

function failureText(stepNo: number, results: VerifyResult[]): string {
  const lines = [`Step ${stepNo} is not done yet: its gate checks failed in the sandbox, so the session did not advance.`, ""];
  for (const r of results) {
    lines.push(`## ${r.passed ? "PASS" : "FAIL"}: ${r.label} (exit ${r.exitCode}, ${r.execMs} ms)`);
    if (r.passed) continue;
    if (r.stdout.trim()) lines.push("stdout:", "```", tail(r.stdout.trimEnd()), "```");
    if (r.stderr.trim()) lines.push("stderr:", "```", tail(r.stderr.trimEnd()), "```");
  }
  lines.push("", "Fix the problem with sandbox_run, then call next_step again with the same completed_step.");
  return lines.join("\n");
}

/**
 * Runs the `verify` checks of step `index` (0-based) in the session's sandbox before the session advances (PLANO.md 6.3).
 * Steps without `verify` pass with no proof. A failed check blocks the advance and returns stdout/stderr to the model.
 */
export async function verifyStep(pkg: SolverPackage, session: Session, index: number): Promise<StepVerifyOutcome> {
  const checks = pkg.steps[index]?.verify ?? [];
  if (!checks.length) return { passed: true, proofs: [] };
  const { passed, results } = await runStepVerify({ userId: session.userId, sessionId: session.id, agentId: session.agentId, checks });
  if (!passed) return { passed: false, text: failureText(index + 1, results) };
  return { passed: true, proofs: results.map((r) => ({ label: r.label, exitCode: r.exitCode, execMs: r.execMs })) };
}

/** "Proven in the sandbox" block appended to the next_step response. */
export function proofText(stepNo: number, proofs: StepProof[]): string {
  if (!proofs.length) return "";
  return [`## Step ${stepNo} gate proven in the sandbox`, ...proofs.map((p) => `- [x] ${p.label} (exit ${p.exitCode}, ${p.execMs} ms)`)].join("\n");
}
