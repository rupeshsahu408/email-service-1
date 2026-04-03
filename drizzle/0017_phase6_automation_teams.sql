-- Phase 6: automation rules, workflows, team workspaces, notifications, audit, reminders, API tokens.

CREATE TABLE IF NOT EXISTS "important_contacts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "pattern" VARCHAR(320) NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "important_contacts_user_pattern_unique" ON "important_contacts" ("user_id", "pattern");
CREATE INDEX IF NOT EXISTS "important_contacts_user_idx" ON "important_contacts" ("user_id");

CREATE TABLE IF NOT EXISTS "email_automation_rules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" VARCHAR(128) NOT NULL DEFAULT '',
  "enabled" BOOLEAN DEFAULT true NOT NULL,
  "sort_order" INTEGER DEFAULT 0 NOT NULL,
  "conditions" JSONB NOT NULL,
  "actions" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS "email_automation_rules_user_enabled_idx" ON "email_automation_rules" ("user_id", "enabled", "sort_order");

CREATE TABLE IF NOT EXISTS "automation_workflows" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" VARCHAR(128) NOT NULL DEFAULT '',
  "enabled" BOOLEAN DEFAULT true NOT NULL,
  "trigger_conditions" JSONB NOT NULL,
  "steps" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS "automation_workflows_user_enabled_idx" ON "automation_workflows" ("user_id", "enabled");

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" VARCHAR(128) NOT NULL DEFAULT '',
  "inbox_owner_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS "workspaces_inbox_owner_idx" ON "workspaces" ("inbox_owner_user_id");

CREATE TABLE IF NOT EXISTS "workspace_members" (
  "workspace_id" UUID NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" VARCHAR(16) NOT NULL,
  "joined_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY ("workspace_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "workspace_members_user_idx" ON "workspace_members" ("user_id");

CREATE TABLE IF NOT EXISTS "scheduled_reminders" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "message_id" UUID REFERENCES "messages"("id") ON DELETE CASCADE,
  "kind" VARCHAR(24) NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "remind_at" TIMESTAMPTZ NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS "scheduled_reminders_user_status_idx" ON "scheduled_reminders" ("user_id", "status", "remind_at");
CREATE INDEX IF NOT EXISTS "scheduled_reminders_due_idx" ON "scheduled_reminders" ("status", "remind_at");

CREATE TABLE IF NOT EXISTS "user_notifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" VARCHAR(32) NOT NULL,
  "title" VARCHAR(256) NOT NULL DEFAULT '',
  "body" TEXT NOT NULL DEFAULT '',
  "read_at" TIMESTAMPTZ,
  "meta" JSONB,
  "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS "user_notifications_user_created_idx" ON "user_notifications" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "user_notifications_user_unread_idx" ON "user_notifications" ("user_id", "read_at");

CREATE TABLE IF NOT EXISTS "user_audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "action" VARCHAR(64) NOT NULL,
  "resource_type" VARCHAR(64) NOT NULL DEFAULT '',
  "resource_id" VARCHAR(128) NOT NULL DEFAULT '',
  "detail" TEXT,
  "meta" JSONB,
  "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS "user_audit_logs_user_created_idx" ON "user_audit_logs" ("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "user_api_access_tokens" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" VARCHAR(64) NOT NULL,
  "label" VARCHAR(128) NOT NULL DEFAULT '',
  "scopes" JSONB,
  "last_used_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_api_access_tokens_hash_unique" ON "user_api_access_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "user_api_access_tokens_user_idx" ON "user_api_access_tokens" ("user_id");

ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "priority" VARCHAR(16) NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS "assigned_to_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "messages_assigned_idx" ON "messages" ("assigned_to_user_id");
CREATE INDEX IF NOT EXISTS "messages_resolved_idx" ON "messages" ("resolved_at");
