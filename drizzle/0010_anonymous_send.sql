-- Anonymous outbound send: alias mapping + flags (recipient sees anon-*@domain only).

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sent_anonymously" boolean DEFAULT false NOT NULL;

ALTER TABLE "scheduled_emails" ADD COLUMN IF NOT EXISTS "send_anonymously" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "anonymous_send_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "alias_local_part" varchar(96) NOT NULL,
  "message_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'anonymous_send_aliases_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "anonymous_send_aliases"
      ADD CONSTRAINT "anonymous_send_aliases_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'anonymous_send_aliases_message_id_messages_id_fk'
  ) THEN
    ALTER TABLE "anonymous_send_aliases"
      ADD CONSTRAINT "anonymous_send_aliases_message_id_messages_id_fk"
      FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "anonymous_send_aliases_local_unique" ON "anonymous_send_aliases" ("alias_local_part");
CREATE INDEX IF NOT EXISTS "anonymous_send_aliases_user_idx" ON "anonymous_send_aliases" ("user_id");
