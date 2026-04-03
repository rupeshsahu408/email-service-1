import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { messages, scheduledReminders } from "@/db/schema";
import { recordUserAudit } from "@/lib/user-audit";
import { getAuthContext } from "@/lib/session";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  messageId: z.string().uuid().optional(),
  kind: z.string().max(24).default("follow_up"),
  note: z.string().max(2000).optional(),
  remindAt: z.string(),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await getDb()
    .select()
    .from(scheduledReminders)
    .where(
      and(
        eq(scheduledReminders.userId, ctx.user.id),
        eq(scheduledReminders.status, "pending")
      )
    )
    .orderBy(asc(scheduledReminders.remindAt));
  return NextResponse.json({ reminders: rows });
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
  const remindAt = new Date(parsed.data.remindAt);
  if (!Number.isFinite(remindAt.getTime())) {
    return NextResponse.json({ error: "Invalid remindAt" }, { status: 400 });
  }

  if (parsed.data.messageId) {
    const [m] = await getDb()
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(eq(messages.id, parsed.data.messageId), eq(messages.userId, ctx.user.id))
      )
      .limit(1);
    if (!m) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
  }

  const [row] = await getDb()
    .insert(scheduledReminders)
    .values({
      userId: ctx.user.id,
      messageId: parsed.data.messageId ?? null,
      kind: parsed.data.kind,
      note: parsed.data.note ?? "",
      remindAt,
      status: "pending",
    })
    .returning();

  await recordUserAudit({
    userId: ctx.user.id,
    action: "reminder_schedule",
    resourceType: "reminder",
    resourceId: row.id,
  });

  return NextResponse.json({ reminder: row });
}
