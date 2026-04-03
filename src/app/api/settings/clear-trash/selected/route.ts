import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { getAuthContext } from "@/lib/session";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const ids = [...new Set(parsed.data.ids)];
  const db = getDb();

  const ownedTrash = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(eq(messages.userId, ctx.user.id), eq(messages.folder, "trash"), inArray(messages.id, ids))
    );

  if (ownedTrash.length === 0) {
    return NextResponse.json({ ok: true, deletedIds: [] });
  }

  const ownedIds = ownedTrash.map((r) => r.id);

  await db.delete(messages).where(and(eq(messages.userId, ctx.user.id), inArray(messages.id, ownedIds)));

  return NextResponse.json({ ok: true, deletedIds: ownedIds });
}

