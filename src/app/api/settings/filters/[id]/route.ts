import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { labels, mailFilterRules } from "@/db/schema";
import { getAuthContext } from "@/lib/session";

const patchSchema = z.object({
  fromMatch: z.string().min(1).max(320).optional(),
  action: z.enum(["trash", "label"]).optional(),
  labelId: z.string().uuid().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const existing = await getDb()
    .select()
    .from(mailFilterRules)
    .where(
      and(eq(mailFilterRules.id, id), eq(mailFilterRules.userId, ctx.user.id))
    )
    .limit(1);
  if (existing.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const nextAction = parsed.data.action ?? existing[0].action;
  const nextLabelId =
    parsed.data.labelId !== undefined
      ? parsed.data.labelId
      : existing[0].labelId;
  if (nextAction === "label" && !nextLabelId) {
    return NextResponse.json(
      { error: "Label rules need a label." },
      { status: 400 }
    );
  }
  if (nextLabelId) {
    const owns = await getDb()
      .select({ id: labels.id })
      .from(labels)
      .where(and(eq(labels.id, nextLabelId), eq(labels.userId, ctx.user.id)))
      .limit(1);
    if (owns.length === 0) {
      return NextResponse.json({ error: "Invalid label" }, { status: 400 });
    }
  }
  const patch: Record<string, unknown> = {};
  if (parsed.data.fromMatch !== undefined) {
    patch.fromMatch = parsed.data.fromMatch.trim().toLowerCase();
  }
  if (parsed.data.action !== undefined) patch.action = parsed.data.action;
  if (parsed.data.labelId !== undefined) patch.labelId = parsed.data.labelId;
  if (parsed.data.action === "trash") patch.labelId = null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  await getDb()
    .update(mailFilterRules)
    .set(patch as typeof mailFilterRules.$inferInsert)
    .where(
      and(eq(mailFilterRules.id, id), eq(mailFilterRules.userId, ctx.user.id))
    );
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const res = await getDb()
    .delete(mailFilterRules)
    .where(
      and(eq(mailFilterRules.id, id), eq(mailFilterRules.userId, ctx.user.id))
    )
    .returning({ id: mailFilterRules.id });
  if (res.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
