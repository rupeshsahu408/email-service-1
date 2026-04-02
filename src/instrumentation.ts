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

        console.log("[startup] DB schema bootstrap complete.");
      } finally {
        await sql.end();
      }
    } catch (err) {
      console.error("[startup] DB migration failed:", err);
    }
  }
}
