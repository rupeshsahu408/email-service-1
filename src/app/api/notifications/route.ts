import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { userNotifications } from "@/db/schema";
import { getAuthContext } from "@/lib/session";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  markReadIds: z.array(z.string().uuid()).optional(),
  markAllRead: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const unreadOnly = request.nextUrl.searchParams.get("unread") === "1";
  const rows = await getDb()
    .select()
    .from(userNotifications)
    .where(
      unreadOnly
        ? and(
            eq(userNotifications.userId, ctx.user.id),
            isNull(userNotifications.readAt)
          )
        : eq(userNotifications.userId, ctx.user.id)
    )
    .orderBy(desc(userNotifications.createdAt))
    .limit(100);
  return NextResponse.json({ notifications: rows });
}

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
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const now = new Date();
  if (parsed.data.markAllRead) {
    await getDb()
      .update(userNotifications)
      .set({ readAt: now })
      .where(
        and(
          eq(userNotifications.userId, ctx.user.id),
          isNull(userNotifications.readAt)
        )
      );
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.markReadIds?.length) {
    for (const id of parsed.data.markReadIds) {
      await getDb()
        .update(userNotifications)
        .set({ readAt: now })
        .where(
          and(eq(userNotifications.id, id), eq(userNotifications.userId, ctx.user.id))
        );
    }
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Nothing to do" }, { status: 400 });
}
