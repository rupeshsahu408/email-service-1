import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { getAuthContext } from "@/lib/session";

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await getDb()
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, ctx.user.id),
        ne(sessions.id, ctx.session.id)
      )
    );
  return NextResponse.json({ ok: true });
}
