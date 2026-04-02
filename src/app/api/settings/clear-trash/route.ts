import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { getAuthContext } from "@/lib/session";

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await getDb()
    .delete(messages)
    .where(
      and(eq(messages.userId, ctx.user.id), eq(messages.folder, "trash"))
    );
  return NextResponse.json({ ok: true });
}
