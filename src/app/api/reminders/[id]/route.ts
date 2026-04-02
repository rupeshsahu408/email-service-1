import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { scheduledReminders } from "@/db/schema";
import { recordUserAudit } from "@/lib/user-audit";
import { getAuthContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const [row] = await getDb()
    .update(scheduledReminders)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(scheduledReminders.id, id),
        eq(scheduledReminders.userId, ctx.user.id),
        eq(scheduledReminders.status, "pending")
      )
    )
    .returning();
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await recordUserAudit({
    userId: ctx.user.id,
    action: "reminder_cancel",
    resourceType: "reminder",
    resourceId: id,
  });
  return NextResponse.json({ ok: true });
}
