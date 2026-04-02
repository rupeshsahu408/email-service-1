CREATE TABLE "auth_login_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outcome" varchar(16) NOT NULL,
	"auth_method" varchar(24) NOT NULL,
	"context" varchar(24) NOT NULL,
	"user_id" uuid,
	"identifier" varchar(320) NOT NULL,
	"failure_code" varchar(64),
	"ip_hint" varchar(45),
	"user_agent" text,
	"geo_country" varchar(128),
	"geo_city" varchar(256),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "security_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "security_lock_reason" text;--> statement-breakpoint
ALTER TABLE "auth_login_events" ADD CONSTRAINT "auth_login_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_login_events_created_idx" ON "auth_login_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "auth_login_events_user_created_idx" ON "auth_login_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "auth_login_events_ip_created_idx" ON "auth_login_events" USING btree ("ip_hint","created_at");--> statement-breakpoint
CREATE INDEX "auth_login_events_identifier_idx" ON "auth_login_events" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "auth_login_events_failed_idx" ON "auth_login_events" USING btree ("outcome","created_at");
