CREATE TABLE "scheduled_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"to_addr" text DEFAULT '' NOT NULL,
	"cc_addr" text DEFAULT '' NOT NULL,
	"bcc_addr" text DEFAULT '' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body_text" text DEFAULT '' NOT NULL,
	"body_html" text DEFAULT '' NOT NULL,
	"mailbox_id" varchar(128),
	"send_at" timestamp with time zone NOT NULL,
	"status" varchar(32) DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "scheduled_emails_user_send_idx" ON "scheduled_emails" USING btree ("user_id","send_at");--> statement-breakpoint
CREATE INDEX "scheduled_emails_send_at_idx" ON "scheduled_emails" USING btree ("send_at");--> statement-breakpoint
ALTER TABLE "scheduled_emails" ADD CONSTRAINT "scheduled_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "scheduled_email_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheduled_email_id" uuid NOT NULL,
	"filename" varchar(512) NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "scheduled_email_attachments_email_idx" ON "scheduled_email_attachments" USING btree ("scheduled_email_id");--> statement-breakpoint
ALTER TABLE "scheduled_email_attachments" ADD CONSTRAINT "scheduled_email_attachments_scheduled_email_id_scheduled_emails_id_fk" FOREIGN KEY ("scheduled_email_id") REFERENCES "public"."scheduled_emails"("id") ON DELETE cascade ON UPDATE no action;

