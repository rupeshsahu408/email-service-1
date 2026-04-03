import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { importantContacts } from "@/db/schema";
import { invalidateAutomationCache } from "@/lib/email-automation";
import { getAuthContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const res = await getDb()
    .delete(importantContacts)
    .where(
      and(
        eq(importantContacts.id, id),
        eq(importantContacts.userId, ctx.user.id)
      )
    )
    .returning({ id: importantContacts.id });
  if (res.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  invalidateAutomationCache(ctx.user.id);
  return NextResponse.json({ ok: true });
}
