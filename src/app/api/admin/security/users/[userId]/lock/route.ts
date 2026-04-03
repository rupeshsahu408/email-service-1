import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { adminSecurityLockUser } from "@/lib/admin-user-mutations";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  lockedUntil: z.string().datetime().optional(),
  reason: z.string().max(2000).optional(),
});

type Ctx = { params: Promise<{ userId: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await ctx.params;
  if (userId === admin.id) {
    return NextResponse.json(
      { error: "You cannot security-lock your own admin account here." },
      { status: 400 }
    );
  }

  const exists = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (exists.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let lockedUntil: Date | undefined;
  if (parsed.data.lockedUntil) {
    const d = new Date(parsed.data.lockedUntil);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid lockedUntil" }, { status: 400 });
    }
    lockedUntil = d;
  }

  await adminSecurityLockUser({
    actorUserId: admin.id,
    targetUserId: userId,
    lockedUntil,
    reason: parsed.data.reason,
  });

  return NextResponse.json({ ok: true });
}
