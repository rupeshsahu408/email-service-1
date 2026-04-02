import { getDb } from "@/db";
import { userAuditLogs } from "@/db/schema";
import { logError } from "@/lib/logger";

export async function recordUserAudit(entry: {
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  detail?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await getDb().insert(userAuditLogs).values({
      userId: entry.userId,
      action: entry.action,
      resourceType: entry.resourceType ?? "",
      resourceId: entry.resourceId ?? "",
      detail: entry.detail ?? null,
      meta: entry.meta,
    });
  } catch (e) {
    logError("user_audit_insert_failed", {
      message: e instanceof Error ? e.message : String(e),
      action: entry.action,
    });
  }
}
