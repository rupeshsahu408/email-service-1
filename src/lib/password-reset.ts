import "dotenv/config";
import { createHash } from "crypto";

let _migrationRan = false;

/**
 * Adds password reset token columns if missing.
 * Safe to call multiple times (idempotent).
 */
export async function ensurePasswordResetColumns(): Promise<void> {
  if (_migrationRan) return;
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
        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT,
          ADD COLUMN IF NOT EXISTS password_reset_token_expires_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS password_reset_token_used_at TIMESTAMPTZ
      `;
      _migrationRan = true;
      // Intentionally no logging here; this can run in production on-demand.
    } finally {
      await sql.end();
    }
  } catch {
    // Best-effort: if this fails, routes will return a generic server error.
  }
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

