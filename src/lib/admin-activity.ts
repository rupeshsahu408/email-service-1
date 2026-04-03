import { getDb } from "@/db";
import { adminActivityLogs } from "@/db/schema";
import { randomUUID } from "crypto";

type AdminActivitySeverity = "info" | "warning" | "error" | "success";

type RecordAdminActivityInput = {
  eventType: string;
  severity?: AdminActivitySeverity;
  actorUserId?: string | null;
  subjectUserId?: string | null;
  detail?: string;
  meta?: Record<string, unknown>;
};

let _adminActivityTableEnsured = false;

export async function ensureAdminActivityTable(): Promise<void> {
  if (_adminActivityTableEnsured) return;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;
  try {
    const { default: postgres } = await import("postgres");
    const sql = postgres(connectionString, { max: 1, idle_timeout: 10, connect_timeout: 15 });
    try {
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
      _adminActivityTableEnsured = true;
    } finally {
      await sql.end();
    }
  } catch {
    // Best effort. Reads/writes that rely on this table gracefully degrade.
  }
}

export async function recordAdminActivity(input: RecordAdminActivityInput): Promise<void> {
  try {
    await ensureAdminActivityTable();
    await getDb().insert(adminActivityLogs).values({
      id: randomUUID(),
      eventType: input.eventType.slice(0, 64),
      severity: (input.severity ?? "info").slice(0, 16),
      actorUserId: input.actorUserId ?? null,
      subjectUserId: input.subjectUserId ?? null,
      detail: input.detail ?? null,
      meta: input.meta ?? null,
      createdAt: new Date(),
    });
  } catch {
    // Activity logs are non-critical and should not break primary user flows.
  }
}
