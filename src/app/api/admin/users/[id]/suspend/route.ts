import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { adminSuspendBodySchema } from "@/lib/validation";
import { adminSuspendUser } from "@/lib/admin-user-mutations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (id === admin.id) {
    return NextResponse.json(
      { error: "You cannot suspend your own account" },
      { status: 400 }
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = adminSuspendBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const exists = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (exists.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await adminSuspendUser({
    actorUserId: admin.id,
    targetUserId: id,
    reason: parsed.data.reason,
  });

  return NextResponse.json({ ok: true });
}
