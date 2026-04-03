ALTER TABLE "billing_subscriptions" ADD COLUMN IF NOT EXISTS "start_at" timestamptz DEFAULT NOW();
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD COLUMN IF NOT EXISTS "end_at" timestamptz;
--> statement-breakpoint
UPDATE "billing_subscriptions" SET "start_at" = COALESCE("start_at", "current_start_at", "created_at") WHERE "start_at" IS NULL;
--> statement-breakpoint
UPDATE "billing_subscriptions" SET "end_at" = COALESCE("end_at", "current_end_at") WHERE "end_at" IS NULL;
--> statement-breakpoint
UPDATE "billing_subscriptions" SET "start_at" = COALESCE("created_at", NOW()) WHERE "start_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ALTER COLUMN "start_at" SET DEFAULT NOW();
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ALTER COLUMN "start_at" SET NOT NULL;
