import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { adminAppendNoteBodySchema } from "@/lib/validation";
import { appendAdminNote } from "@/lib/admin-user-mutations";
import { recordAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = adminAppendNoteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const exists = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (exists.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await appendAdminNote({ targetUserId: id, text: parsed.data.text });
  await recordAdminActivity({
    eventType: "admin_user_note",
    severity: "info",
    actorUserId: admin.id,
    subjectUserId: id,
    detail: "Internal note added.",
  });

  return NextResponse.json({ ok: true });
}
