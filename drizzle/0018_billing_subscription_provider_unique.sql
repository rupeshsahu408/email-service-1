-- Idempotent: ensures ON CONFLICT (provider_subscription_id) works on all deployments.
CREATE UNIQUE INDEX IF NOT EXISTS "billing_subscriptions_provider_sub_unique" ON "billing_subscriptions" USING btree ("provider_subscription_id");
