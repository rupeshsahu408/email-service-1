import { logError } from "@/lib/logger";

/**
 * Ensures `messages` columns referenced by the current Drizzle schema exist on the database.
 * Drizzle emits INSERTs that include every column (with DEFAULT), so missing columns cause 42703.
 *
 * Idempotent: matches drizzle/0009, 0010, 0011 (IF NOT EXISTS).
 */
let _messagesOptionalColsEnsured = false;

/** Forces the next `ensureMessagesOptionalColumns()` run (e.g. after a 42703 insert). */
export function resetMessagesOptionalColumnsCache(): void {
  _messagesOptionalColsEnsured = false;
}

export async function ensureMessagesOptionalColumns(): Promise<void> {
  if (_messagesOptionalColsEnsured) return;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  try {
    const { default: postgres } = await import("postgres");
    const sql = postgres(connectionString, {
      max: 1,
      idle_timeout: 10,
      connect_timeout: 15,
    });
    try {
      await sql`
        ALTER TABLE messages
          ADD COLUMN IF NOT EXISTS mailed_by text,
          ADD COLUMN IF NOT EXISTS signed_by text,
          ADD COLUMN IF NOT EXISTS sent_anonymously boolean DEFAULT false NOT NULL,
          ADD COLUMN IF NOT EXISTS trash_moved_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS trash_delete_after_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS spam_score integer DEFAULT 0 NOT NULL,
          ADD COLUMN IF NOT EXISTS priority varchar(16) DEFAULT 'normal' NOT NULL,
          ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS messages_assigned_idx
        ON messages (assigned_to_user_id)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS messages_resolved_idx
        ON messages (resolved_at)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS messages_trash_expiry_idx
        ON messages (folder, trash_delete_after_at)
      `;
      _messagesOptionalColsEnsured = true;
    } finally {
      await sql.end();
    }
  } catch (err) {
    logError("message_schema_ensure_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
