ALTER TABLE "billing_subscriptions" ADD COLUMN IF NOT EXISTS "billing_cycle" varchar(16) DEFAULT 'monthly';
--> statement-breakpoint
UPDATE "billing_subscriptions" SET "billing_cycle" = COALESCE(NULLIF(TRIM("billing_cycle"), ''), "interval", 'monthly') WHERE "billing_cycle" IS NULL OR TRIM("billing_cycle") = '';
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ALTER COLUMN "billing_cycle" SET DEFAULT 'monthly';
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ALTER COLUMN "billing_cycle" SET NOT NULL;
