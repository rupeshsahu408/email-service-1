import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { revokeAllSessions } from "@/lib/admin-user-mutations";
import { recordAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ userId: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await ctx.params;
  const exists = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (exists.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await revokeAllSessions(userId);
  await recordAdminActivity({
    eventType: "admin_security_revoke_all_sessions",
    severity: "info",
    actorUserId: admin.id,
    subjectUserId: userId,
    detail: "All sessions revoked from Security Center.",
  });

  return NextResponse.json({ ok: true });
}
