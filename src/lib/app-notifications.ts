import { getDb } from "@/db";
import { userNotifications } from "@/db/schema";
import { logError } from "@/lib/logger";

export async function createUserNotification(params: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await getDb().insert(userNotifications).values({
      userId: params.userId,
      type: params.type,
      title: params.title.slice(0, 256),
      body: (params.body ?? "").slice(0, 4000),
      meta: params.meta,
    });
  } catch (e) {
    logError("user_notification_insert_failed", {
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
