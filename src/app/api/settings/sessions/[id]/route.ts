import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { getAuthContext } from "@/lib/session";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  if (id === ctx.session.id) {
    return NextResponse.json(
      { error: "Use Log out to end this session." },
      { status: 400 }
    );
  }
  const res = await getDb()
    .delete(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.userId, ctx.user.id)))
    .returning({ id: sessions.id });
  if (res.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
