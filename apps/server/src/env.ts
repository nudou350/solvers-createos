import { z } from "zod";

// Environment of the API, the worker and the CLIs (docs/hackathon/CONTRACTS.md, "Env"). Source of truth for configuration;
// the template with every variable is apps/server/.env.example. Real values live in the repo-root .env (written by
// Stripe Projects) and, optionally, apps/server/.env (wins over the root one).

/** An empty variable in .env (`X=`) counts as unset (applied before every optional parser below). */
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const bool = z.preprocess(
  blank,
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => v === "true" || v === "1"),
);

/** An empty variable in .env (`X=`) counts as unset. */
const blankToUndefined = z
  .string()
  .optional()
  .transform((v) => v?.trim() || undefined);

/** Real CreateOS sandboxes or the local fake. Default simulated: real ones are opted into (free plan: 10 creations a day). */
const execMode = z.preprocess(blank, z.enum(["createos", "simulated"]).default("simulated"));

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3038),
  /** Interface the API listens on (0.0.0.0 inside a container). */
  HOST: z.string().default("127.0.0.1"),
  /** Public URL of the API (same domain as the web app: /api /mcp /oauth /.well-known). */
  PUBLIC_API_URL: z.string().url().default("http://localhost:3038"),
  PUBLIC_WEB_URL: z.string().url().default("http://localhost:3041"),

  /** Falls back to NEON_POSTGRES_CONNECTION_STRING (the Neon database Stripe Projects provisions into the root .env). */
  DATABASE_URL: z.string().default("postgres://solvers:solvers@127.0.0.1:5547/solvers_createos"),

  // ---- auth ----
  JWT_SECRET: z.string().min(32),
  /** 32 bytes in base64: wraps each user's memory data key (AES-256-GCM). */
  MEMORY_KEK: z.string().refine((v) => Buffer.from(v, "base64").length === 32, "MEMORY_KEK must be 32 bytes in base64"),
  /** User ids (uuid, comma separated) that review submissions and run admin actions on the site. */
  ADMIN_USER_IDS: z.string().default(""),
  /** 1 = the magic link is printed to the log and returned by POST /api/auth/email (dev and demo only). */
  DEV_LOGIN: bool.default("false"),
  /** Sends the magic-link e-mails (Resend). Without it, only DEV_LOGIN logs in. */
  RESEND_API_KEY: blankToUndefined,
  EMAIL_FROM: z.string().default("Solvers <onboarding@resend.dev>"),

  // ---- Stripe (test mode) ----
  STRIPE_SECRET_KEY: blankToUndefined,
  STRIPE_PUBLISHABLE_KEY: blankToUndefined,
  STRIPE_WEBHOOK_SECRET: blankToUndefined,

  // ---- CreateOS Sandbox ----
  CREATEOS_SANDBOX_API_KEY: blankToUndefined,
  CREATEOS_SANDBOX_BASE_URL: z.string().url().default("https://api-eu.sb.createos.sh"),
  /** Where sandbox_run / sandbox_preview and step `verify` checks run. */
  SANDBOX_MODE: execMode,
  /** Where the verifier runs package tests. */
  VERIFIER_MODE: execMode,
  SANDBOX_SHAPE: z.string().default("s-1vcpu-1gb"),

  CLOUDINARY_CLOUD_NAME: blankToUndefined,
  CLOUDINARY_API_KEY: blankToUndefined,
  CLOUDINARY_API_SECRET: blankToUndefined,

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ADMIN_CHAT_ID: z.string().optional(),

  EMBEDDING_MODEL: z.string().default("Xenova/multilingual-e5-small"),
  SEARCH_MODE: z.enum(["local", "fts"]).default("local"),

  AGENTS_DIR: z.string().default("../../agents"),
  SUBMISSIONS_DIR: z.string().default("./data/submissions"),
  PUBLISHED_DIR: z.string().default("./data/packages"),
  SUBMISSION_MAX_ZIP_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  SUBMISSION_MAX_UNZIPPED_BYTES: z.coerce.number().int().positive().default(150 * 1024 * 1024),
  SUBMISSION_MAX_FILES: z.coerce.number().int().positive().default(2000),
  SUBMISSION_MAX_PENDING: z.coerce.number().int().min(1).default(3),
  SUBMISSION_MAX_PER_DAY: z.coerce.number().int().min(1).default(5),
  SUBMISSIONS_INLINE: bool.default("false"),
  SEARCH_DAILY_QUOTA: z.coerce.number().int().min(0).default(300),
  DELIVERABLES_DIR: z.string().default("./deliverables"),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().default(60),
});

export type Env = z.infer<typeof schema>;

/** Cross-variable rules (pure, testable). Returns the refusal message or null. */
export function configProblem(e: Env): string | null {
  if ((e.SANDBOX_MODE === "createos" || e.VERIFIER_MODE === "createos") && !e.CREATEOS_SANDBOX_API_KEY) {
    return "SANDBOX_MODE/VERIFIER_MODE=createos requires CREATEOS_SANDBOX_API_KEY.";
  }
  return null;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // `X=` in .env means unset: without this, z.coerce turns "" into 0 and string minimums reject it.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v.trim() !== ""));
  cleaned.DATABASE_URL ??= cleaned.NEON_POSTGRES_CONNECTION_STRING;
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  const problem = configProblem(parsed.data);
  if (problem) throw new Error(`Configuration refused: ${problem}`);
  return parsed.data;
}

export const env = loadEnv();
