import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { adminSecurityUnlockUser } from "@/lib/admin-user-mutations";

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

  await adminSecurityUnlockUser({
    actorUserId: admin.id,
    targetUserId: userId,
  });

  return NextResponse.json({ ok: true });
}
