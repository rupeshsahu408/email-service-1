CREATE TABLE "billing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_type" varchar(32) NOT NULL,
	"interval" varchar(16) NOT NULL,
	"provider" varchar(32) DEFAULT 'razorpay' NOT NULL,
	"provider_subscription_id" varchar(128) NOT NULL,
	"provider_plan_id" varchar(128),
	"status" varchar(32) DEFAULT 'created' NOT NULL,
	"auto_renew" boolean DEFAULT true NOT NULL,
	"current_start_at" timestamp with time zone,
	"current_end_at" timestamp with time zone,
	"next_billing_at" timestamp with time zone,
	"cancel_at_cycle_end" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_type" varchar(32) NOT NULL,
	"interval" varchar(16) NOT NULL,
	"provider" varchar(32) DEFAULT 'razorpay' NOT NULL,
	"provider_payment_id" varchar(128) NOT NULL,
	"provider_order_id" varchar(128),
	"provider_subscription_id" varchar(128),
	"provider_plan_id" varchar(128),
	"amount" integer DEFAULT 0 NOT NULL,
	"currency" varchar(16) DEFAULT 'INR' NOT NULL,
	"status" varchar(32) NOT NULL,
	"captured_at" timestamp with time zone,
	"failed_reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscriptions_provider_sub_unique" ON "billing_subscriptions" USING btree ("provider_subscription_id");
--> statement-breakpoint
CREATE INDEX "billing_subscriptions_user_idx" ON "billing_subscriptions" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "billing_subscriptions_status_idx" ON "billing_subscriptions" USING btree ("status","next_billing_at");
--> statement-breakpoint
CREATE INDEX "billing_subscriptions_product_idx" ON "billing_subscriptions" USING btree ("product_type","interval");
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_payments_provider_payment_unique" ON "billing_payments" USING btree ("provider_payment_id");
--> statement-breakpoint
CREATE INDEX "billing_payments_user_idx" ON "billing_payments" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "billing_payments_status_idx" ON "billing_payments" USING btree ("status","captured_at");
--> statement-breakpoint
CREATE INDEX "billing_payments_product_idx" ON "billing_payments" USING btree ("product_type","interval");
--> statement-breakpoint
CREATE INDEX "billing_payments_subscription_idx" ON "billing_payments" USING btree ("provider_subscription_id");
