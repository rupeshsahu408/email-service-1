import postgres from "postgres";
import {
  getBootstrapDatabaseUrl,
  postgresJsOptions,
} from "@/lib/postgres-connection";

export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" ||
    process.env.NEXT_RUNTIME === undefined
  ) {
    if (process.env.SKIP_STARTUP_DB_BOOTSTRAP === "1") {
      console.warn(
        "[startup] SKIP_STARTUP_DB_BOOTSTRAP=1 — skipping inline schema bootstrap (use deploy-time migrations)."
      );
      return;
    }
    try {
      const connectionString = getBootstrapDatabaseUrl();
      if (!connectionString) {
        console.warn("[startup] DATABASE_URL not set — skipping migration.");
        return;
      }
      const sql = postgres(
        connectionString,
        postgresJsOptions(connectionString, "bootstrap")
      );
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS users (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            local_part VARCHAR(64) NOT NULL,
            password_hash TEXT NOT NULL,
            recovery_key_hash TEXT NOT NULL,
            last_login_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            plan VARCHAR(16) NOT NULL DEFAULT 'free',
            plan_status VARCHAR(16) NOT NULL DEFAULT 'free',
            plan_expires_at TIMESTAMPTZ,
            razorpay_order_id VARCHAR(128),
            razorpay_subscription_id VARCHAR(128)
          )
        `;
        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS users_local_part_unique ON users(local_part)
        `;

        await sql`
          CREATE TABLE IF NOT EXISTS sessions (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            user_agent TEXT,
            ip_hint VARCHAR(45),
            last_used_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_unique ON sessions(token_hash)`;
        await sql`CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)`;
        await sql`CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at)`;

        await sql`
          CREATE TABLE IF NOT EXISTS messages (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            folder VARCHAR(16) NOT NULL,
            provider_message_id VARCHAR(512),
            subject TEXT NOT NULL DEFAULT '',
            snippet TEXT NOT NULL DEFAULT '',
            body_text TEXT NOT NULL DEFAULT '',
            body_html TEXT,
            from_addr TEXT NOT NULL DEFAULT '',
            to_addr TEXT NOT NULL DEFAULT '',
            cc_addr TEXT NOT NULL DEFAULT '',
            bcc_addr TEXT NOT NULL DEFAULT '',
            read_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            starred BOOLEAN NOT NULL DEFAULT FALSE,
            pinned BOOLEAN NOT NULL DEFAULT FALSE,
            pinned_at TIMESTAMPTZ,
            thread_id UUID NOT NULL,
            in_reply_to TEXT,
            has_attachment BOOLEAN NOT NULL DEFAULT FALSE
          )
        `;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS messages_provider_msg_unique ON messages(user_id, provider_message_id)`;
        await sql`CREATE INDEX IF NOT EXISTS messages_user_folder_created_idx ON messages(user_id, folder, created_at)`;
        await sql`CREATE INDEX IF NOT EXISTS messages_user_thread_idx ON messages(user_id, thread_id)`;
        await sql`CREATE INDEX IF NOT EXISTS messages_user_starred_idx ON messages(user_id, starred)`;
        await sql`CREATE INDEX IF NOT EXISTS messages_user_pinned_idx ON messages(user_id, pinned, pinned_at)`;

        await sql`
          CREATE TABLE IF NOT EXISTS labels (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(64) NOT NULL,
            color VARCHAR(7),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS labels_user_name_unique ON labels(user_id, name)`;

        await sql`
          CREATE TABLE IF NOT EXISTS user_settings (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            theme VARCHAR(16) NOT NULL DEFAULT 'system',
            accent_hex VARCHAR(7) NOT NULL DEFAULT '#5b4dff',
            conversation_view BOOLEAN NOT NULL DEFAULT TRUE,
            unread_first BOOLEAN NOT NULL DEFAULT FALSE,
            inbox_density VARCHAR(16) NOT NULL DEFAULT 'comfortable',
            signature_html TEXT NOT NULL DEFAULT '',
            compose_font VARCHAR(32) NOT NULL DEFAULT 'system',
            draft_auto_save BOOLEAN NOT NULL DEFAULT TRUE,
            block_trackers BOOLEAN NOT NULL DEFAULT TRUE,
            read_receipts_outgoing BOOLEAN NOT NULL DEFAULT FALSE,
            external_images VARCHAR(16) NOT NULL DEFAULT 'ask',
            notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;

        await sql`
          CREATE TABLE IF NOT EXISTS blocked_senders (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            email VARCHAR(320) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS blocked_senders_user_email ON blocked_senders(user_id, email)`;

        await sql`
          CREATE TABLE IF NOT EXISTS mail_filter_rules (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            from_match VARCHAR(320) NOT NULL,
            action VARCHAR(16) NOT NULL,
            label_id UUID REFERENCES labels(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS mail_filter_rules_user_idx ON mail_filter_rules(user_id)`;

        await sql`
          CREATE TABLE IF NOT EXISTS message_labels (
            message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
            PRIMARY KEY (message_id, label_id)
          )
        `;

        await sql`
          CREATE TABLE IF NOT EXISTS attachments (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            filename VARCHAR(512) NOT NULL,
            mime_type VARCHAR(255) NOT NULL,
            size_bytes INTEGER NOT NULL,
            storage_key TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS attachments_message_idx ON attachments(message_id)`;

        await sql`
          CREATE TABLE IF NOT EXISTS compose_drafts (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            to_addr TEXT NOT NULL DEFAULT '',
            cc_addr TEXT NOT NULL DEFAULT '',
            bcc_addr TEXT NOT NULL DEFAULT '',
            subject TEXT NOT NULL DEFAULT '',
            body_text TEXT NOT NULL DEFAULT '',
            body_html TEXT NOT NULL DEFAULT '',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;

        await sql`
          CREATE TABLE IF NOT EXISTS compose_attachments (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            filename VARCHAR(512) NOT NULL,
            mime_type VARCHAR(255) NOT NULL,
            size_bytes INTEGER NOT NULL,
            storage_key TEXT NOT NULL,
            content_id VARCHAR(512),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS compose_attachments_user_idx ON compose_attachments(user_id)`;

        await sql`
          ALTER TABLE users
            ADD COLUMN IF NOT EXISTS plan VARCHAR(16) NOT NULL DEFAULT 'free',
            ADD COLUMN IF NOT EXISTS plan_status VARCHAR(16) NOT NULL DEFAULT 'free',
            ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(128),
            ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(128)
        `;
        await sql`
          ALTER TABLE users
            ADD COLUMN IF NOT EXISTS razorpay_plan_id VARCHAR(128),
            ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS subscription_auto_renew BOOLEAN DEFAULT TRUE NOT NULL
        `;
        await sql`
          ALTER TABLE users
            ADD COLUMN IF NOT EXISTS pro_plan_status VARCHAR(16) NOT NULL DEFAULT 'free',
            ADD COLUMN IF NOT EXISTS pro_plan_expires_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS pro_razorpay_subscription_id VARCHAR(128),
            ADD COLUMN IF NOT EXISTS pro_razorpay_plan_id VARCHAR(128),
            ADD COLUMN IF NOT EXISTS pro_next_billing_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS pro_billing_period_start TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS pro_subscription_auto_renew BOOLEAN DEFAULT TRUE NOT NULL
        `;

        await sql`
          ALTER TABLE users
            ADD COLUMN IF NOT EXISTS temp_inbox_plan_status VARCHAR(16) NOT NULL DEFAULT 'free',
            ADD COLUMN IF NOT EXISTS temp_inbox_plan_expires_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS temp_razorpay_subscription_id VARCHAR(128),
            ADD COLUMN IF NOT EXISTS temp_razorpay_plan_id VARCHAR(128),
            ADD COLUMN IF NOT EXISTS temp_next_billing_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS temp_subscription_auto_renew BOOLEAN DEFAULT TRUE NOT NULL
        `;
        await sql`
          CREATE TABLE IF NOT EXISTS business_profiles (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            business_name VARCHAR(256) DEFAULT '' NOT NULL,
            display_name_default VARCHAR(256) DEFAULT '' NOT NULL,
            logo_url TEXT,
            website VARCHAR(512),
            support_contact VARCHAR(320),
            brand_color VARCHAR(7),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`
          CREATE TABLE IF NOT EXISTS professional_profiles (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            handle VARCHAR(32) NOT NULL,
            email_address VARCHAR(320) NOT NULL,
            display_name VARCHAR(256),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS professional_profiles_handle_unique ON professional_profiles(handle)`;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS professional_profiles_email_unique ON professional_profiles(email_address)`;

        await sql`
          CREATE TABLE IF NOT EXISTS temp_inbox_aliases (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            local_part VARCHAR(64) NOT NULL,
            email_address VARCHAR(320) NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            expiry_minutes INTEGER NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS temp_inbox_alias_email_unique ON temp_inbox_aliases(email_address)`;
        await sql`CREATE INDEX IF NOT EXISTS temp_inbox_alias_user_idx ON temp_inbox_aliases(user_id)`;
        await sql`CREATE INDEX IF NOT EXISTS temp_inbox_alias_expires_idx ON temp_inbox_aliases(expires_at)`;

        await sql`
          CREATE TABLE IF NOT EXISTS temp_inbox_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            alias_id UUID NOT NULL REFERENCES temp_inbox_aliases(id) ON DELETE CASCADE,
            provider_message_id VARCHAR(512) NOT NULL,
            received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            from_addr TEXT NOT NULL DEFAULT '',
            subject TEXT NOT NULL DEFAULT '',
            otp_code VARCHAR(16),
            otp_matched_at TIMESTAMPTZ,
            snippet TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS temp_inbox_provider_msg_unique
          ON temp_inbox_messages(user_id, provider_message_id)
        `;
        await sql`CREATE INDEX IF NOT EXISTS temp_inbox_messages_user_received_idx ON temp_inbox_messages(user_id, received_at)`;
        await sql`CREATE INDEX IF NOT EXISTS temp_inbox_messages_alias_idx ON temp_inbox_messages(alias_id)`;

        await sql`
          CREATE TABLE IF NOT EXISTS temp_inbox_unclaimed_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            email_address VARCHAR(320) NOT NULL,
            provider_message_id VARCHAR(512) NOT NULL,
            received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            from_addr TEXT NOT NULL DEFAULT '',
            subject TEXT NOT NULL DEFAULT '',
            otp_code VARCHAR(16),
            otp_matched_at TIMESTAMPTZ,
            snippet TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;

        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS temp_inbox_unclaimed_provider_msg_unique
          ON temp_inbox_unclaimed_messages(email_address, provider_message_id)
        `;
        await sql`CREATE INDEX IF NOT EXISTS temp_inbox_unclaimed_email_idx ON temp_inbox_unclaimed_messages(email_address)`;
        await sql`CREATE INDEX IF NOT EXISTS temp_inbox_unclaimed_expires_idx ON temp_inbox_unclaimed_messages(expires_at)`;
        await sql`CREATE INDEX IF NOT EXISTS temp_inbox_unclaimed_received_idx ON temp_inbox_unclaimed_messages(received_at)`;
        await sql`
          CREATE TABLE IF NOT EXISTS domains (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            domain_name VARCHAR(255) NOT NULL,
            verification_status VARCHAR(32) DEFAULT 'dns_pending' NOT NULL,
            verification_token VARCHAR(128) NOT NULL,
            dns_records_snapshot JSONB,
            verified_at TIMESTAMPTZ,
            last_check_at TIMESTAMPTZ,
            failure_reason TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS domains_domain_name_unique ON domains(domain_name)`;
        await sql`CREATE INDEX IF NOT EXISTS domains_owner_idx ON domains(owner_user_id)`;
        await sql`
          CREATE TABLE IF NOT EXISTS mailboxes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
            local_part VARCHAR(64) NOT NULL,
            email_address VARCHAR(320) NOT NULL,
            display_name_override VARCHAR(256),
            active BOOLEAN DEFAULT TRUE NOT NULL,
            is_default_sender BOOLEAN DEFAULT FALSE NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS mailboxes_domain_local_unique ON mailboxes(domain_id, local_part)`;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS mailboxes_email_address_unique ON mailboxes(email_address)`;
        await sql`CREATE INDEX IF NOT EXISTS mailboxes_domain_idx ON mailboxes(domain_id)`;

        await sql`
          CREATE TABLE IF NOT EXISTS scheduled_emails (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            to_addr TEXT NOT NULL DEFAULT '',
            cc_addr TEXT NOT NULL DEFAULT '',
            bcc_addr TEXT NOT NULL DEFAULT '',
            subject TEXT NOT NULL DEFAULT '',
            body_text TEXT NOT NULL DEFAULT '',
            body_html TEXT NOT NULL DEFAULT '',
            mailbox_id VARCHAR(128),
            send_at TIMESTAMPTZ NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
            send_anonymously BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            cancelled_at TIMESTAMPTZ
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS scheduled_emails_user_send_idx ON scheduled_emails(user_id, send_at)`;
        await sql`CREATE INDEX IF NOT EXISTS scheduled_emails_send_at_idx ON scheduled_emails(send_at)`;

        await sql`
          ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS sent_anonymously BOOLEAN NOT NULL DEFAULT FALSE
        `;
        await sql`
          ALTER TABLE scheduled_emails
            ADD COLUMN IF NOT EXISTS send_anonymously BOOLEAN NOT NULL DEFAULT FALSE
        `;
        await sql`
          CREATE TABLE IF NOT EXISTS anonymous_send_aliases (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            alias_local_part VARCHAR(96) NOT NULL,
            message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS anonymous_send_aliases_local_unique ON anonymous_send_aliases(alias_local_part)`;
        await sql`CREATE INDEX IF NOT EXISTS anonymous_send_aliases_user_idx ON anonymous_send_aliases(user_id)`;

        await sql`
          CREATE TABLE IF NOT EXISTS important_contacts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            pattern VARCHAR(320) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS important_contacts_user_pattern_unique ON important_contacts(user_id, pattern)`;
        await sql`CREATE INDEX IF NOT EXISTS important_contacts_user_idx ON important_contacts(user_id)`;

        await sql`
          CREATE TABLE IF NOT EXISTS email_automation_rules (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(128) NOT NULL DEFAULT '',
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            conditions JSONB NOT NULL,
            actions JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS email_automation_rules_user_enabled_idx ON email_automation_rules(user_id, enabled, sort_order)`;

        await sql`
          CREATE TABLE IF NOT EXISTS automation_workflows (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(128) NOT NULL DEFAULT '',
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            trigger_conditions JSONB NOT NULL,
            steps JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS automation_workflows_user_enabled_idx ON automation_workflows(user_id, enabled)`;

        await sql`
          CREATE TABLE IF NOT EXISTS workspaces (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            name VARCHAR(128) NOT NULL DEFAULT '',
            inbox_owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS workspaces_inbox_owner_idx ON workspaces(inbox_owner_user_id)`;

        await sql`
          CREATE TABLE IF NOT EXISTS workspace_members (
            workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role VARCHAR(16) NOT NULL,
            joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (workspace_id, user_id)
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON workspace_members(user_id)`;

        await sql`
          CREATE TABLE IF NOT EXISTS scheduled_reminders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
            kind VARCHAR(24) NOT NULL,
            note TEXT NOT NULL DEFAULT '',
            remind_at TIMESTAMPTZ NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS scheduled_reminders_user_status_idx ON scheduled_reminders(user_id, status, remind_at)`;
        await sql`CREATE INDEX IF NOT EXISTS scheduled_reminders_due_idx ON scheduled_reminders(status, remind_at)`;

        await sql`
          CREATE TABLE IF NOT EXISTS user_notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(32) NOT NULL,
            title VARCHAR(256) NOT NULL DEFAULT '',
            body TEXT NOT NULL DEFAULT '',
            read_at TIMESTAMPTZ,
            meta JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS user_notifications_user_created_idx ON user_notifications(user_id, created_at)`;

        await sql`
          CREATE TABLE IF NOT EXISTS user_audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            action VARCHAR(64) NOT NULL,
            resource_type VARCHAR(64) NOT NULL DEFAULT '',
            resource_id VARCHAR(128) NOT NULL DEFAULT '',
            detail TEXT,
            meta JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS user_audit_logs_user_created_idx ON user_audit_logs(user_id, created_at)`;

        await sql`
          CREATE TABLE IF NOT EXISTS user_api_access_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(64) NOT NULL,
            label VARCHAR(128) NOT NULL DEFAULT '',
            scopes JSONB,
            last_used_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS user_api_access_tokens_hash_unique ON user_api_access_tokens(token_hash)`;

        await sql`
          CREATE TABLE IF NOT EXISTS billing_subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            product_type VARCHAR(32) NOT NULL,
            "interval" VARCHAR(16) NOT NULL,
            provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
            provider_subscription_id VARCHAR(128) NOT NULL,
            provider_plan_id VARCHAR(128),
            status VARCHAR(32) NOT NULL DEFAULT 'created',
            auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
            current_start_at TIMESTAMPTZ,
            current_end_at TIMESTAMPTZ,
            next_billing_at TIMESTAMPTZ,
            cancel_at_cycle_end BOOLEAN NOT NULL DEFAULT FALSE,
            cancelled_at TIMESTAMPTZ,
            metadata JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`
          ALTER TABLE billing_subscriptions
            ADD COLUMN IF NOT EXISTS user_id UUID,
            ADD COLUMN IF NOT EXISTS product_type VARCHAR(32),
            ADD COLUMN IF NOT EXISTS "interval" VARCHAR(16),
            ADD COLUMN IF NOT EXISTS provider VARCHAR(32) DEFAULT 'razorpay',
            ADD COLUMN IF NOT EXISTS provider_subscription_id VARCHAR(128),
            ADD COLUMN IF NOT EXISTS provider_plan_id VARCHAR(128),
            ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'created',
            ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS current_start_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS current_end_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS cancel_at_cycle_end BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS metadata JSONB,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
        `;
        await sql`
          UPDATE billing_subscriptions
          SET provider_subscription_id = 'legacy-' || id::text
          WHERE provider_subscription_id IS NULL
        `;
        await sql`
          ALTER TABLE billing_subscriptions
            ALTER COLUMN provider_subscription_id SET NOT NULL
        `;
        await sql`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conname = 'billing_subscriptions_user_id_users_id_fk'
            ) THEN
              ALTER TABLE billing_subscriptions
                ADD CONSTRAINT billing_subscriptions_user_id_users_id_fk
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
            END IF;
          END $$
        `;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS billing_subscriptions_provider_sub_unique ON billing_subscriptions(provider_subscription_id)`;
        await sql`CREATE INDEX IF NOT EXISTS billing_subscriptions_user_idx ON billing_subscriptions(user_id, created_at)`;
        await sql`CREATE INDEX IF NOT EXISTS billing_subscriptions_status_idx ON billing_subscriptions(status, next_billing_at)`;
        await sql`CREATE INDEX IF NOT EXISTS billing_subscriptions_product_idx ON billing_subscriptions(product_type, "interval")`;

        await sql`
          CREATE TABLE IF NOT EXISTS billing_payments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            product_type VARCHAR(32) NOT NULL,
            "interval" VARCHAR(16) NOT NULL,
            provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
            provider_payment_id VARCHAR(128) NOT NULL,
            provider_order_id VARCHAR(128),
            provider_subscription_id VARCHAR(128),
            provider_plan_id VARCHAR(128),
            amount INTEGER NOT NULL DEFAULT 0,
            currency VARCHAR(16) NOT NULL DEFAULT 'INR',
            status VARCHAR(32) NOT NULL,
            captured_at TIMESTAMPTZ,
            failed_reason TEXT,
            metadata JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;
        await sql`
          ALTER TABLE billing_payments
            ADD COLUMN IF NOT EXISTS user_id UUID,
            ADD COLUMN IF NOT EXISTS product_type VARCHAR(32),
            ADD COLUMN IF NOT EXISTS "interval" VARCHAR(16),
            ADD COLUMN IF NOT EXISTS provider VARCHAR(32) DEFAULT 'razorpay',
            ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(128),
            ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(128),
            ADD COLUMN IF NOT EXISTS provider_subscription_id VARCHAR(128),
            ADD COLUMN IF NOT EXISTS provider_plan_id VARCHAR(128),
            ADD COLUMN IF NOT EXISTS amount INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS currency VARCHAR(16) DEFAULT 'INR',
            ADD COLUMN IF NOT EXISTS status VARCHAR(32),
            ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS failed_reason TEXT,
            ADD COLUMN IF NOT EXISTS metadata JSONB,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
        `;
        await sql`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conname = 'billing_payments_user_id_users_id_fk'
            ) THEN
              ALTER TABLE billing_payments
                ADD CONSTRAINT billing_payments_user_id_users_id_fk
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
            END IF;
          END $$
        `;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS billing_payments_provider_payment_unique ON billing_payments(provider_payment_id)`;
        await sql`CREATE INDEX IF NOT EXISTS billing_payments_user_idx ON billing_payments(user_id, created_at)`;
        await sql`CREATE INDEX IF NOT EXISTS billing_payments_status_idx ON billing_payments(status, captured_at)`;
        await sql`CREATE INDEX IF NOT EXISTS billing_payments_product_idx ON billing_payments(product_type, "interval")`;
        await sql`CREATE INDEX IF NOT EXISTS billing_payments_subscription_idx ON billing_payments(provider_subscription_id)`;

        await sql`
          ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS priority VARCHAR(16) NOT NULL DEFAULT 'normal',
            ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ
        `;
        await sql`CREATE INDEX IF NOT EXISTS messages_assigned_idx ON messages(assigned_to_user_id)`;
        await sql`CREATE INDEX IF NOT EXISTS messages_resolved_idx ON messages(resolved_at)`;

        console.log("[startup] DB schema bootstrap complete.");
      } finally {
        await sql.end();
      }
    } catch (err) {
      console.error("[startup] DB migration failed:", err);
    }
  }
}
