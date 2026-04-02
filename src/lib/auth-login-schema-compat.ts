import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";

function isMissingSecurityColumnsError(e: unknown): boolean {
  if (
    e &&
    typeof e === "object" &&
    "code" in e &&
    (e as { code: string }).code === "42703"
  ) {
    return true;
  }
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("security_locked_until") || msg.includes("security_lock_reason")
  );
}

/**
 * When DB migration 0014 is not applied yet, selecting security lock columns fails.
 * Returns null for lock state if those columns are missing (treat as unlocked).
 */
export async function fetchSecurityLockIfExists(
  userId: string
): Promise<{ securityLockedUntil: Date | null }> {
  try {
    const row = await getDb()
      .select({
        securityLockedUntil: users.securityLockedUntil,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((r) => r[0] ?? null);
    return {
      securityLockedUntil: row?.securityLockedUntil ?? null,
    };
  } catch (e) {
    if (isMissingSecurityColumnsError(e)) {
      return { securityLockedUntil: null };
    }
    throw e;
  }
}
