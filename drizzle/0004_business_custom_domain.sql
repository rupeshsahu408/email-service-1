ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "razorpay_plan_id" varchar(128);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "next_billing_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "billing_period_start" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_auto_renew" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"business_name" varchar(256) DEFAULT '' NOT NULL,
	"display_name_default" varchar(256) DEFAULT '' NOT NULL,
	"logo_url" text,
	"website" varchar(512),
	"support_contact" varchar(320),
	"brand_color" varchar(7),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"domain_name" varchar(255) NOT NULL,
	"verification_status" varchar(32) DEFAULT 'dns_pending' NOT NULL,
	"verification_token" varchar(128) NOT NULL,
	"dns_records_snapshot" jsonb,
	"verified_at" timestamp with time zone,
	"last_check_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "domains_domain_name_unique" ON "domains" USING btree ("domain_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domains_owner_idx" ON "domains" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mailboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL REFERENCES "domains"("id") ON DELETE CASCADE,
	"local_part" varchar(64) NOT NULL,
	"email_address" varchar(320) NOT NULL,
	"display_name_override" varchar(256),
	"active" boolean DEFAULT true NOT NULL,
	"is_default_sender" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mailboxes_domain_local_unique" ON "mailboxes" USING btree ("domain_id", "local_part");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mailboxes_email_address_unique" ON "mailboxes" USING btree ("email_address");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mailboxes_domain_idx" ON "mailboxes" USING btree ("domain_id");
