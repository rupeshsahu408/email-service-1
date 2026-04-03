CREATE TABLE IF NOT EXISTS "domain_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"actor_type" varchar(16) NOT NULL,
	"actor_user_id" uuid,
	"detail" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "domain_diagnostics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"issues" jsonb NOT NULL,
	"health" varchar(16) NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "domain_dns_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"check_type" varchar(32) NOT NULL,
	"status" varchar(16) NOT NULL,
	"expected_summary" text,
	"observed_raw" jsonb,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "admin_notes" text;
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "operational_status" varchar(32) DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "suspended_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "suspended_by" uuid;
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "suspension_reason" text;
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "sending_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "sending_disabled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "sending_disabled_by" uuid;
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "sending_disable_reason" text;
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "sending_disabled_source" varchar(16);
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "last_auto_activated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "last_auto_sending_enabled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "dkim_selector" varchar(64) DEFAULT 'resend' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "domain_activity_logs" ADD CONSTRAINT "domain_activity_logs_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "domain_activity_logs" ADD CONSTRAINT "domain_activity_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "domain_diagnostics" ADD CONSTRAINT "domain_diagnostics_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "domain_dns_checks" ADD CONSTRAINT "domain_dns_checks_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "domains" ADD CONSTRAINT "domains_suspended_by_users_id_fk" FOREIGN KEY ("suspended_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "domains" ADD CONSTRAINT "domains_sending_disabled_by_users_id_fk" FOREIGN KEY ("sending_disabled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domain_activity_logs_domain_created_idx" ON "domain_activity_logs" USING btree ("domain_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domain_activity_logs_event_idx" ON "domain_activity_logs" USING btree ("event_type","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domain_diagnostics_domain_idx" ON "domain_diagnostics" USING btree ("domain_id","computed_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domain_dns_checks_domain_idx" ON "domain_dns_checks" USING btree ("domain_id","checked_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domain_dns_checks_domain_type_idx" ON "domain_dns_checks" USING btree ("domain_id","check_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domains_verification_status_idx" ON "domains" USING btree ("verification_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domains_operational_status_idx" ON "domains" USING btree ("operational_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domains_sending_enabled_idx" ON "domains" USING btree ("sending_enabled");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domains_sending_disabled_source_idx" ON "domains" USING btree ("sending_disabled_source");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domains_last_check_idx" ON "domains" USING btree ("last_check_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domains_created_idx" ON "domains" USING btree ("created_at");
--> statement-breakpoint
UPDATE "domains" SET
  "operational_status" = 'active',
  "sending_enabled" = true,
  "sending_disabled_source" = NULL,
  "sending_disable_reason" = NULL
WHERE "verification_status" = 'verified'
  AND "operational_status" = 'pending';
