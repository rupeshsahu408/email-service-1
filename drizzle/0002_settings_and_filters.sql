CREATE TABLE "blocked_senders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mail_filter_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"from_match" varchar(320) NOT NULL,
	"action" varchar(16) NOT NULL,
	"label_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"theme" varchar(16) DEFAULT 'system' NOT NULL,
	"accent_hex" varchar(7) DEFAULT '#5b4dff' NOT NULL,
	"conversation_view" boolean DEFAULT true NOT NULL,
	"unread_first" boolean DEFAULT false NOT NULL,
	"inbox_density" varchar(16) DEFAULT 'comfortable' NOT NULL,
	"signature_html" text DEFAULT '' NOT NULL,
	"compose_font" varchar(32) DEFAULT 'system' NOT NULL,
	"draft_auto_save" boolean DEFAULT true NOT NULL,
	"block_trackers" boolean DEFAULT true NOT NULL,
	"read_receipts_outgoing" boolean DEFAULT false NOT NULL,
	"external_images" varchar(16) DEFAULT 'ask' NOT NULL,
	"notifications_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "color" varchar(7);--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "ip_hint" varchar(45);--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "last_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "blocked_senders" ADD CONSTRAINT "blocked_senders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_filter_rules" ADD CONSTRAINT "mail_filter_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_filter_rules" ADD CONSTRAINT "mail_filter_rules_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blocked_senders_user_email" ON "blocked_senders" USING btree ("user_id","email");--> statement-breakpoint
CREATE INDEX "mail_filter_rules_user_idx" ON "mail_filter_rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");