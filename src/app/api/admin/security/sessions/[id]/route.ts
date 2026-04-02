import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { recordAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, ctx: Ctx) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const deleted = await getDb()
    .delete(sessions)
    .where(eq(sessions.id, id))
    .returning({ userId: sessions.userId });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await recordAdminActivity({
    eventType: "admin_security_session_revoked",
    severity: "info",
    actorUserId: admin.id,
    subjectUserId: deleted[0].userId,
    detail: "Session revoked from Security Center.",
    meta: { sessionId: id },
  });

  return NextResponse.json({ ok: true });
}
