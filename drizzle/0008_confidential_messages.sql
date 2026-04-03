CREATE TABLE IF NOT EXISTS "confidential_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" varchar(64) NOT NULL,
  "subject" text NOT NULL DEFAULT '',
  "body_text" text NOT NULL DEFAULT '',
  "body_html" text NOT NULL DEFAULT '',
  "passcode_mode" varchar(16) NOT NULL DEFAULT 'none',
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "confidential_messages_token_hash_unique"
  ON "confidential_messages" ("token_hash");

CREATE INDEX IF NOT EXISTS "confidential_messages_owner_idx"
  ON "confidential_messages" ("owner_user_id", "created_at");

CREATE INDEX IF NOT EXISTS "confidential_messages_expires_idx"
  ON "confidential_messages" ("expires_at");

CREATE TABLE IF NOT EXISTS "confidential_otps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid NOT NULL REFERENCES "confidential_messages"("id") ON DELETE CASCADE,
  "email" varchar(320) NOT NULL,
  "code_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "confidential_otps_message_email_idx"
  ON "confidential_otps" ("message_id", "email", "created_at");

CREATE INDEX IF NOT EXISTS "confidential_otps_expires_idx"
  ON "confidential_otps" ("expires_at");
