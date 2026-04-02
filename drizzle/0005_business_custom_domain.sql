CREATE TABLE "business_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"business_name" varchar(256) DEFAULT '' NOT NULL,
	"display_name_default" varchar(256) DEFAULT '' NOT NULL,
	"logo_url" text,
	"website" varchar(512),
	"support_contact" varchar(320),
	"brand_color" varchar(7),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
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
CREATE TABLE "mailboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"local_part" varchar(64) NOT NULL,
	"email_address" varchar(320) NOT NULL,
	"display_name_override" varchar(256),
	"active" boolean DEFAULT true NOT NULL,
	"is_default_sender" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "messages_provider_msg_unique";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan" varchar(16) DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_status" varchar(16) DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "razorpay_order_id" varchar(128);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "razorpay_subscription_id" varchar(128);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "razorpay_plan_id" varchar(128);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "next_billing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "billing_period_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_auto_renew" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "domains_domain_name_unique" ON "domains" USING btree ("domain_name");--> statement-breakpoint
CREATE INDEX "domains_owner_idx" ON "domains" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mailboxes_domain_local_unique" ON "mailboxes" USING btree ("domain_id","local_part");--> statement-breakpoint
CREATE UNIQUE INDEX "mailboxes_email_address_unique" ON "mailboxes" USING btree ("email_address");--> statement-breakpoint
CREATE INDEX "mailboxes_domain_idx" ON "mailboxes" USING btree ("domain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_provider_msg_unique" ON "messages" USING btree ("user_id","provider_message_id");