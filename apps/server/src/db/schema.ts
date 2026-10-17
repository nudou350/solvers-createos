import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import type { AgentTranslations, AgentVersion, BeforeAfter, Requirement } from "@solvers/shared";

// Database baseline (docs/hackathon/CONTRACTS.md, "Database"). Conventions: identity is `users.id` (uuid) and every
// per-person column is a uuid FK to it; money is integer USD cents; timestamps are timestamptz. Extensions: citext
// (users.email) and pgvector (embeddings), created by the baseline migration.

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});
/** Case-insensitive text (citext extension). */
const citext = customType<{ data: string }>({
  dataType: () => "citext",
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const u64 = (name: string) => bigint(name, { mode: "bigint" });

// ---- identity ----

/** One row per person. The e-mail is stored normalized (auth/person.ts), so aliases of one mailbox are one user. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: citext("email").notNull().unique(),
  emailVerifiedAt: ts("email_verified_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/** Magic-link tokens (auth/magic-link.ts): only the hash is stored; single use, short TTL. */
export const loginTokens = pgTable(
  "login_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
  },
  (t) => [index("login_tokens_user_idx").on(t.userId)],
);

const userRef = (name: string) => uuid(name).references(() => users.id);

// ---- creators and submissions ----

export const creators = pgTable(
  "creators",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id").notNull().unique(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    bio: text("bio").notNull().default(""),
    telegramChatId: text("telegram_chat_id"),
    /** Invited to submit packages (PACKAGE_SPEC.md 14.1). */
    invited: boolean("invited").notNull().default(false),
    /** Creator terms accepted; required to submit a package. */
    termsAcceptedAt: ts("terms_accepted_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    /** Telegram linking (PACKAGE_SPEC.md 14.1): only the HASH of the one-time `LINK-XXXXXXXX` code, valid 15 min. */
    telegramLinkHash: text("telegram_link_hash"),
    telegramLinkExpiresAt: ts("telegram_link_expires_at"),
    /** 1 h window and how many codes were issued in it (max 5 per hour per creator). */
    telegramLinkWindowStart: ts("telegram_link_window_start"),
    telegramLinkCount: integer("telegram_link_count").notNull().default(0),
  },
  (t) => [uniqueIndex("creators_telegram_link_hash_idx").on(t.telegramLinkHash).where(sql`${t.telegramLinkHash} is not null`)],
);

/** Creator invites: the code goes by e-mail and the user is bound when it is redeemed. */
export const creatorInvites = pgTable("creator_invites", {
  code: text("code").primaryKey(),
  email: text("email"),
  note: text("note"),
  userId: userRef("user_id"),
  createdAt: ts("created_at").notNull().defaultNow(),
  usedAt: ts("used_at"),
});

/** Submission states (PACKAGE_SPEC.md 14.2); source of truth: SUBMISSION_STATUSES in @solvers/shared. */
export const packageSubmissions = pgTable(
  "package_submissions",
  {
    id: text("id").primaryKey(),
    creatorUserId: userRef("creator_user_id").notNull(),
    /** Agent id (32 hex): assigned by the server on the first version of a slug. */
    agentId: text("agent_id").notNull(),
    slug: text("slug").notNull(),
    version: text("version").notNull(),
    status: text("status").notNull().default("submitted"),
    zipPath: text("zip_path"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    manifest: jsonb("manifest").$type<Record<string, unknown>>(),
    validation: jsonb("validation").$type<Record<string, unknown>>(),
    scans: jsonb("scans").$type<Record<string, unknown>>(),
    /** Price/hash frozen at approval (publishing reads from here, never from the client). */
    approved: jsonb("approved").$type<{ versionHash: string; priceCents: number; name: string; version: string } | null>(),
    reviewerNotes: text("reviewer_notes"),
    error: text("error"),
    /** Worker attempts (each claim counts); past the cap the submission is rejected (poison pill). */
    attempts: integer("attempts").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("package_submissions_creator_idx").on(t.creatorUserId, t.createdAt),
    index("package_submissions_status_idx").on(t.status),
    index("package_submissions_slug_idx").on(t.slug),
  ],
);

/** Review audit trail: INSERT ONLY (PACKAGE_SPEC.md 17, item 8). */
export const packageReviews = pgTable(
  "package_reviews",
  {
    id: serial("id").primaryKey(),
    submissionId: text("submission_id").notNull(),
    reviewerUserId: userRef("reviewer_user_id").notNull(),
    action: text("action").notNull(), // approve | request_changes | reject | suspend | resume | finish
    notes: text("notes").notNull().default(""),
    checklist: jsonb("checklist").$type<Record<string, boolean>>().notNull().default({}),
    versionHash: text("version_hash"),
    diffSnapshot: jsonb("diff_snapshot").$type<Record<string, unknown>>(),
    ip: text("ip"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("package_reviews_submission_idx").on(t.submissionId)],
);

/** Knowledge ingestion queue in the worker, with a checkpoint per file (PACKAGE_SPEC.md 16). */
export const ingestJobs = pgTable(
  "ingest_jobs",
  {
    id: serial("id").primaryKey(),
    submissionId: text("submission_id").notNull(),
    status: text("status").notNull().default("queued"), // queued | running | done | failed
    filesTotal: integer("files_total").notNull().default(0),
    filesDone: integer("files_done").notNull().default(0),
    chunksDone: integer("chunks_done").notNull().default(0),
    error: text("error"),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
  },
  (t) => [uniqueIndex("ingest_jobs_submission_idx").on(t.submissionId)],
);

/** Version approved by review (PACKAGE_SPEC.md 15.4), written when the review approves it. */
export const agentPublishedVersions = pgTable(
  "agent_published_versions",
  {
    agentId: text("agent_id").notNull(),
    version: text("version").notNull(),
    versionHash: text("version_hash").notNull(),
    priceCents: integer("price_cents").notNull(),
    approvedAt: ts("approved_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.agentId, t.version] })],
);

// ---- catalog ----

export type AgentDetails = {
  beforeAfter?: BeforeAfter[];
  versions?: AgentVersion[];
  tools?: { name: string; description: string; runner: string }[];
  catalogOnly?: boolean;
};

export const agents = pgTable(
  "agents",
  {
    id: text("id").primaryKey(), // manifest id, 32 hex
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    tagline: text("tagline").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    creatorId: text("creator_id").notNull(),
    version: text("version").notNull(),
    /** Every version_hash column stores 64 lowercase hex (the package hash form). */
    versionHash: text("version_hash").notNull(),
    priceCents: integer("price_cents").notNull(),
    /** Eval of `evalVersionHash` (D6): "measured" only when it equals versionHash. */
    evalScoreBps: integer("eval_score_bps").notNull().default(0),
    evalHash: text("eval_hash"),
    evalVersionHash: text("eval_version_hash"),
    /** Platform kill switch: active | suspended (PACKAGE_SPEC.md 15.4). */
    platformStatus: text("platform_status").notNull().default("active"),
    totalSales: u64("total_sales").notNull().default(sql`0`),
    verifiedUses: u64("verified_uses").notNull().default(sql`0`),
    ratingSum: u64("rating_sum").notNull().default(sql`0`),
    ratingCount: integer("rating_count").notNull().default(0),
    requirements: jsonb("requirements").$type<Requirement[]>().notNull().default([]),
    packageContents: jsonb("package_contents").$type<string[]>().notNull().default([]),
    /** Catalog texts per language (locales/<lang>.json of the package): { pt: {...} }. English is in the columns above. */
    translations: jsonb("translations").$type<AgentTranslations>().notNull().default({}),
    /** Only shown in the store after the catalog (publish-agent) filled the data. */
    listed: boolean("listed").notNull().default(false),
    details: jsonb("details").$type<AgentDetails>().notNull().default({}),
    searchText: text("search_text").notNull().default(""),
    embedding: vector("embedding", { dimensions: 384 }),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("agents_fts_idx").using("gin", sql`to_tsvector('portuguese', ${t.searchText})`)],
);

/** A purchased Solver. Created by the Stripe webhook; the Checkout Session id makes the purchase idempotent. */
export const licenses = pgTable(
  "licenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: text("agent_id").notNull(),
    userId: userRef("user_id").notNull(),
    /** Package version current when the license was granted. */
    versionHash: text("version_hash"),
    /** Review written with this license, null when unused. */
    reviewId: text("review_id"),
    acquiredAt: ts("acquired_at").notNull().defaultNow(),
    type: text("type").notNull().default("permanent"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
  },
  (t) => [index("licenses_user_idx").on(t.userId), index("licenses_agent_idx").on(t.agentId)],
);

/** Free trial per user and Solver: uses, searches and tool runs (manifest.trial). */
export const trials = pgTable(
  "trials",
  {
    agentId: text("agent_id").notNull(),
    userId: userRef("user_id").notNull(),
    used: integer("used").notNull().default(0),
    searchesUsed: integer("searches_used").notNull().default(0),
    toolRuns: jsonb("tool_runs").$type<Record<string, number>>().notNull().default({}),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.agentId, t.userId] })],
);

export const reviews = pgTable(
  "reviews",
  {
    id: text("id").primaryKey(), // `${agentId}:${authorUserId}` (one review per agent and author)
    agentId: text("agent_id").notNull(),
    authorUserId: userRef("author_user_id").notNull(),
    rating: smallint("rating").notNull(),
    text: text("text").notNull().default(""),
    contentHash: text("content_hash").notNull(),
    /** Agent versionHash current at submission (D6). */
    versionHash: text("version_hash"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reviews_agent_author_idx").on(t.agentId, t.authorUserId)],
);

/** Review drafts: text and rating prepared before the review is published, by content hash. */
export const reviewDrafts = pgTable(
  "review_drafts",
  {
    agentId: text("agent_id").notNull(),
    authorUserId: userRef("author_user_id").notNull(),
    contentHash: text("content_hash").notNull(),
    rating: smallint("rating").notNull(),
    text: text("text").notNull().default(""),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.agentId, t.authorUserId, t.contentHash] })],
);

/** Creator gallery (up to 5) and review photos (up to 3); positions are unique per owner so concurrent uploads never exceed the cap. */
export const agentImages = pgTable(
  "agent_images",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id").notNull(),
    position: smallint("position").notNull(),
    key: text("key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("agent_images_pos_idx").on(t.agentId, t.position), check("agent_images_pos_chk", sql`${t.position} between 0 and 4`)],
);

export const reviewImages = pgTable(
  "review_images",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id").notNull(),
    position: smallint("position").notNull(),
    key: text("key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("review_images_pos_idx").on(t.reviewId, t.position), check("review_images_pos_chk", sql`${t.position} between 0 and 2`)],
);

// ---- users ----

/** Profile data (the e-mail comes from the login). */
export const userProfiles = pgTable("user_profiles", {
  userId: userRef("user_id").primaryKey(),
  displayName: text("display_name"),
  email: text("email"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const userReputation = pgTable("user_reputation", {
  userId: userRef("user_id").primaryKey(),
  purchases: integer("purchases").notNull().default(0),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const usageEvents = pgTable(
  "usage_events",
  {
    id: serial("id").primaryKey(),
    userId: userRef("user_id").notNull(),
    agentId: text("agent_id"),
    sessionId: text("session_id"),
    tool: text("tool").notNull(),
    responseHash: text("response_hash"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("usage_agent_created_idx").on(t.agentId, t.createdAt), index("usage_user_idx").on(t.userId)],
);

// ---- connector (MCP) ----

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: userRef("user_id").notNull(),
  agentId: text("agent_id").notNull(),
  version: text("version").notNull(),
  stepIndex: integer("step_index").notNull().default(0),
  access: text("access").notNull(), // license | trial | platform
  context: jsonb("context").$type<Record<string, unknown>>().notNull().default({}),
  licenseId: text("license_id"),
  calls: integer("calls").notNull().default(0),
  expiresAt: ts("expires_at").notNull().default(sql`now() + interval '24 hours'`),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const oauthClients = pgTable("oauth_clients", {
  clientId: text("client_id").primaryKey(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const oauthCodes = pgTable("oauth_codes", {
  code: text("code").primaryKey(),
  clientId: text("client_id").notNull(),
  userId: userRef("user_id").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  scope: text("scope"),
  resource: text("resource"),
  expiresAt: ts("expires_at").notNull(),
});

export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull(),
    userId: userRef("user_id").notNull(),
    refreshHash: text("refresh_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    revoked: boolean("revoked").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("oauth_tokens_user_idx").on(t.userId)],
);

// ---- memory ----

/** Memory key of each user: a random data key wrapped with MEMORY_KEK (AES-256-GCM). */
export const memoryKeys = pgTable("memory_keys", {
  userId: userRef("user_id").primaryKey(),
  wrappedKey: bytea("wrapped_key").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const memories = pgTable(
  "memories",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id").notNull(),
    agentId: text("agent_id").notNull(),
    ciphertext: bytea("ciphertext").notNull(),
    iv: bytea("iv").notNull(),
    tag: bytea("tag").notNull(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("memories_user_agent_idx").on(t.userId, t.agentId)],
);

// ---- knowledge ----

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: serial("id").primaryKey(),
    agentId: text("agent_id").notNull(),
    version: text("version").notNull(),
    source: text("source").notNull(),
    content: text("content").notNull(),
    /** File front-matter (title, source, source_url, source_date, tags, trial); PACKAGE_SPEC.md 6.2. */
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    /** End of validity of the excerpt (valid_until); afterwards search warns "may be outdated". */
    validUntil: date("valid_until"),
    embedding: vector("embedding", { dimensions: 384 }),
  },
  (t) => [
    index("knowledge_agent_idx").on(t.agentId, t.version),
    index("knowledge_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("knowledge_fts_idx").using("gin", sql`to_tsvector('portuguese', ${t.content})`),
  ],
);

/** Extra store-search vectors (tagline and searchPhrases, also in Portuguese); rewritten on every publish. */
export const agentSearchVectors = pgTable(
  "agent_search_vectors",
  {
    id: serial("id").primaryKey(),
    agentId: text("agent_id").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 384 }).notNull(),
  },
  (t) => [index("agent_search_vectors_agent_idx").on(t.agentId)],
);

export const escalations = pgTable("escalations", {
  id: text("id").primaryKey(),
  userId: userRef("user_id").notNull(),
  agentId: text("agent_id").notNull(),
  sessionId: text("session_id"),
  summary: text("summary").notNull(),
  status: text("status").notNull().default("open"),
  notified: boolean("notified").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---- payments ----

/**
 * Payment ledger: one row per charge, written BEFORE the provider call. `provider_ref` is the Stripe Checkout Session id
 * (unique: the webhook fulfils each session once).
 */
export const paymentLedger = pgTable(
  "payment_ledger",
  {
    id: text("id").primaryKey(), // chargeId
    provider: text("provider").notNull(), // stripe | fake
    providerRef: text("provider_ref").unique(),
    kind: text("kind").notNull(), // license
    buyerUserId: userRef("buyer_user_id").notNull(),
    /** Who pays (the buyer, unless someone else pays for them). */
    payerUserId: userRef("payer_user_id").notNull(),
    agentId: text("agent_id").notNull(),
    /** Purchase details needed to fulfil exactly what was charged. */
    intent: jsonb("intent").$type<Record<string, unknown>>().notNull().default({}),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("usd"),
    status: text("status").notNull().default("created"),
    error: text("error"),
    providerPayload: jsonb("provider_payload").$type<Record<string, unknown>>(),
    createdAt: ts("created_at").notNull().defaultNow(),
    confirmedAt: ts("confirmed_at"),
    fulfilledAt: ts("fulfilled_at"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("payment_ledger_status_idx").on(t.status, t.updatedAt), index("payment_ledger_buyer_idx").on(t.buyerUserId)],
);

/** Stripe webhook dedupe: one row per event id; `processed_at` is set once the handler finished. */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: ts("received_at").notNull().defaultNow(),
  processedAt: ts("processed_at"),
});

// ---- code execution (CreateOS Sandbox) ----

/** One CreateOS sandbox per user session; destroyed when idle (sandbox/jobs.ts). */
export const sandboxes = pgTable(
  "sandboxes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userRef("user_id").notNull(),
    sessionId: text("session_id"),
    /** Sandbox id on CreateOS (null while creating, or in simulated mode). */
    createosId: text("createos_id"),
    status: text("status").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastUsedAt: ts("last_used_at").notNull().defaultNow(),
    runs: integer("runs").notNull().default(0),
  },
  (t) => [index("sandboxes_user_idx").on(t.userId), index("sandboxes_status_idx").on(t.status, t.lastUsedAt)],
);

/** Every command run in a sandbox: a model call (run), a step gate check (verify) or a preview. */
export const sandboxRuns = pgTable(
  "sandbox_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sandboxId: uuid("sandbox_id").references(() => sandboxes.id),
    userId: userRef("user_id").notNull(),
    agentId: text("agent_id"),
    command: text("command").notNull(),
    exitCode: integer("exit_code"),
    execMs: integer("exec_ms"),
    stdoutBytes: integer("stdout_bytes").notNull().default(0),
    kind: text("kind").notNull(), // run | verify | preview
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("sandbox_runs_sandbox_idx").on(t.sandboxId), index("sandbox_runs_user_idx").on(t.userId, t.createdAt)],
);
