import { NextResponse } from "next/server";
import postgres from "postgres";

export const runtime = "nodejs";

export async function GET() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL not set" },
      { status: 500 }
    );
  }

  const sql = postgres(connectionString, {
    max: 1,
    idle_timeout: 10,
    connect_timeout: 15,
  });

  try {
    await sql`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS local_part VARCHAR(64),
        ADD COLUMN IF NOT EXISTS password_hash TEXT,
        ADD COLUMN IF NOT EXISTS recovery_key_hash TEXT,
        ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT,
        ADD COLUMN IF NOT EXISTS password_reset_token_expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS password_reset_token_used_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS avatar_url TEXT,
        ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS plan VARCHAR(16) NOT NULL DEFAULT 'free',
        ADD COLUMN IF NOT EXISTS plan_status VARCHAR(16) NOT NULL DEFAULT 'free',
        ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(128),
        ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(128),
        ADD COLUMN IF NOT EXISTS razorpay_plan_id VARCHAR(128),
        ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS subscription_auto_renew BOOLEAN DEFAULT TRUE NOT NULL,
        ADD COLUMN IF NOT EXISTS pro_plan_status VARCHAR(16) NOT NULL DEFAULT 'free',
        ADD COLUMN IF NOT EXISTS pro_plan_expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS pro_razorpay_subscription_id VARCHAR(128),
        ADD COLUMN IF NOT EXISTS pro_razorpay_plan_id VARCHAR(128),
        ADD COLUMN IF NOT EXISTS pro_next_billing_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS pro_billing_period_start TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS pro_subscription_auto_renew BOOLEAN DEFAULT TRUE NOT NULL,
        ADD COLUMN IF NOT EXISTS temp_inbox_plan_status VARCHAR(16) NOT NULL DEFAULT 'free',
        ADD COLUMN IF NOT EXISTS temp_inbox_plan_expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS temp_razorpay_subscription_id VARCHAR(128),
        ADD COLUMN IF NOT EXISTS temp_razorpay_plan_id VARCHAR(128),
        ADD COLUMN IF NOT EXISTS temp_next_billing_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS temp_subscription_auto_renew BOOLEAN DEFAULT TRUE NOT NULL
    `;
    await sql`
      ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS user_id UUID,
        ADD COLUMN IF NOT EXISTS token_hash TEXT,
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS user_agent TEXT,
        ADD COLUMN IF NOT EXISTS ip_hint VARCHAR(45),
        ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS admin_activity_logs (
        id UUID PRIMARY KEY,
        event_type VARCHAR(64) NOT NULL,
        severity VARCHAR(16) NOT NULL DEFAULT 'info',
        actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        subject_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        detail TEXT,
        meta JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS admin_activity_logs_created_idx
      ON admin_activity_logs(created_at)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS admin_activity_logs_type_idx
      ON admin_activity_logs(event_type, created_at)
    `;
    return NextResponse.json({
      ok: true,
      message: "Migration applied: users and sessions auth/subscription columns verified.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  } finally {
    await sql.end();
  }
}
