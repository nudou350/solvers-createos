-- Extensions used by the baseline: citext (users.email), pgvector (embeddings), pgcrypto (gen_random_uuid before PG 13).
CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE TABLE "agent_images" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"position" smallint NOT NULL,
	"key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_images_pos_chk" CHECK ("agent_images"."position" between 0 and 4)
);
--> statement-breakpoint
CREATE TABLE "agent_published_versions" (
	"agent_id" text NOT NULL,
	"version" text NOT NULL,
	"version_hash" text NOT NULL,
	"price_cents" integer NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_published_versions_agent_id_version_pk" PRIMARY KEY("agent_id","version")
);
--> statement-breakpoint
CREATE TABLE "agent_search_vectors" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(384) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"creator_id" text NOT NULL,
	"version" text NOT NULL,
	"version_hash" text NOT NULL,
	"price_cents" integer NOT NULL,
	"eval_score_bps" integer DEFAULT 0 NOT NULL,
	"eval_hash" text,
	"eval_version_hash" text,
	"platform_status" text DEFAULT 'active' NOT NULL,
	"total_sales" bigint DEFAULT 0 NOT NULL,
	"verified_uses" bigint DEFAULT 0 NOT NULL,
	"rating_sum" bigint DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"package_contents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"translations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"listed" boolean DEFAULT false NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"embedding" vector(384),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "creator_invites" (
	"code" text PRIMARY KEY NOT NULL,
	"email" text,
	"note" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"bio" text DEFAULT '' NOT NULL,
	"telegram_chat_id" text,
	"invited" boolean DEFAULT false NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"telegram_link_hash" text,
	"telegram_link_expires_at" timestamp with time zone,
	"telegram_link_window_start" timestamp with time zone,
	"telegram_link_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "creators_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"session_id" text,
	"summary" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"notified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"files_total" integer DEFAULT 0 NOT NULL,
	"files_done" integer DEFAULT 0 NOT NULL,
	"chunks_done" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"version" text NOT NULL,
	"source" text NOT NULL,
	"content" text NOT NULL,
	"meta" jsonb,
	"valid_until" date,
	"embedding" vector(384)
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"version_hash" text,
	"review_id" text,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text DEFAULT 'permanent' NOT NULL,
	"stripe_checkout_session_id" text,
	CONSTRAINT "licenses_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id")
);
--> statement-breakpoint
CREATE TABLE "login_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "login_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"iv" "bytea" NOT NULL,
	"tag" "bytea" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_keys" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"wrapped_key" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"client_id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"code_challenge" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"scope" text,
	"resource" text,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"reviewer_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version_hash" text,
	"diff_snapshot" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_user_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"slug" text NOT NULL,
	"version" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"zip_path" text,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"manifest" jsonb,
	"validation" jsonb,
	"scans" jsonb,
	"approved" jsonb,
	"reviewer_notes" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"kind" text NOT NULL,
	"buyer_user_id" uuid NOT NULL,
	"payer_user_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"intent" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"error" text,
	"provider_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_ledger_provider_ref_unique" UNIQUE("provider_ref")
);
--> statement-breakpoint
CREATE TABLE "review_drafts" (
	"agent_id" text NOT NULL,
	"author_user_id" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"rating" smallint NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_drafts_agent_id_author_user_id_content_hash_pk" PRIMARY KEY("agent_id","author_user_id","content_hash")
);
--> statement-breakpoint
CREATE TABLE "review_images" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text NOT NULL,
	"position" smallint NOT NULL,
	"key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_images_pos_chk" CHECK ("review_images"."position" between 0 and 2)
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"author_user_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"content_hash" text NOT NULL,
	"version_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sandbox_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sandbox_id" uuid,
	"user_id" uuid NOT NULL,
	"agent_id" text,
	"command" text NOT NULL,
	"exit_code" integer,
	"exec_ms" integer,
	"stdout_bytes" integer DEFAULT 0 NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sandboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text,
	"createos_id" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"runs" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"agent_id" text NOT NULL,
	"version" text NOT NULL,
	"step_index" integer DEFAULT 0 NOT NULL,
	"access" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"license_id" text,
	"calls" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '24 hours' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trials" (
	"agent_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"searches_used" integer DEFAULT 0 NOT NULL,
	"tool_runs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trials_agent_id_user_id_pk" PRIMARY KEY("agent_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"agent_id" text,
	"session_id" text,
	"tool" text NOT NULL,
	"response_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_reputation" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"purchases" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "creator_invites" ADD CONSTRAINT "creator_invites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creators" ADD CONSTRAINT "creators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_tokens" ADD CONSTRAINT "login_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_keys" ADD CONSTRAINT "memory_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_reviews" ADD CONSTRAINT "package_reviews_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_submissions" ADD CONSTRAINT "package_submissions_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_ledger" ADD CONSTRAINT "payment_ledger_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_ledger" ADD CONSTRAINT "payment_ledger_payer_user_id_users_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_drafts" ADD CONSTRAINT "review_drafts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_runs" ADD CONSTRAINT "sandbox_runs_sandbox_id_sandboxes_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandboxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_runs" ADD CONSTRAINT "sandbox_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandboxes" ADD CONSTRAINT "sandboxes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trials" ADD CONSTRAINT "trials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reputation" ADD CONSTRAINT "user_reputation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_images_pos_idx" ON "agent_images" USING btree ("agent_id","position");--> statement-breakpoint
CREATE INDEX "agent_search_vectors_agent_idx" ON "agent_search_vectors" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agents_fts_idx" ON "agents" USING gin (to_tsvector('portuguese', "search_text"));--> statement-breakpoint
CREATE UNIQUE INDEX "creators_telegram_link_hash_idx" ON "creators" USING btree ("telegram_link_hash") WHERE "creators"."telegram_link_hash" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ingest_jobs_submission_idx" ON "ingest_jobs" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "knowledge_agent_idx" ON "knowledge_chunks" USING btree ("agent_id","version");--> statement-breakpoint
CREATE INDEX "knowledge_embedding_idx" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "knowledge_fts_idx" ON "knowledge_chunks" USING gin (to_tsvector('portuguese', "content"));--> statement-breakpoint
CREATE INDEX "licenses_user_idx" ON "licenses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "licenses_agent_idx" ON "licenses" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "login_tokens_user_idx" ON "login_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memories_user_agent_idx" ON "memories" USING btree ("user_id","agent_id");--> statement-breakpoint
CREATE INDEX "oauth_tokens_user_idx" ON "oauth_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "package_reviews_submission_idx" ON "package_reviews" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "package_submissions_creator_idx" ON "package_submissions" USING btree ("creator_user_id","created_at");--> statement-breakpoint
CREATE INDEX "package_submissions_status_idx" ON "package_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "package_submissions_slug_idx" ON "package_submissions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "payment_ledger_status_idx" ON "payment_ledger" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "payment_ledger_buyer_idx" ON "payment_ledger" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_images_pos_idx" ON "review_images" USING btree ("review_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_agent_author_idx" ON "reviews" USING btree ("agent_id","author_user_id");--> statement-breakpoint
CREATE INDEX "sandbox_runs_sandbox_idx" ON "sandbox_runs" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "sandbox_runs_user_idx" ON "sandbox_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "sandboxes_user_idx" ON "sandboxes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sandboxes_status_idx" ON "sandboxes" USING btree ("status","last_used_at");--> statement-breakpoint
CREATE INDEX "usage_agent_created_idx" ON "usage_events" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_user_idx" ON "usage_events" USING btree ("user_id");