import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { emailAutomationRules } from "@/db/schema";
import { parseAutomationActions, parseAutomationConditions } from "@/lib/automation-validate";
import { invalidateAutomationCache } from "@/lib/email-automation";
import { getAuthContext } from "@/lib/session";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().max(128).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  conditions: z.unknown().optional(),
  actions: z.unknown().optional(),
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

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
  if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;
  if (parsed.data.sortOrder !== undefined) patch.sortOrder = parsed.data.sortOrder;
  if (parsed.data.conditions !== undefined) {
    const c = parseAutomationConditions(parsed.data.conditions);
    if (!c) {
      return NextResponse.json({ error: "Invalid conditions" }, { status: 400 });
    }
    patch.conditions = c;
  }
  if (parsed.data.actions !== undefined) {
    const a = parseAutomationActions(parsed.data.actions);
    if (!a) {
      return NextResponse.json({ error: "Invalid actions" }, { status: 400 });
    }
    patch.actions = a;
  }

  const [row] = await getDb()
    .update(emailAutomationRules)
    .set(patch as typeof emailAutomationRules.$inferInsert)
    .where(
      and(
        eq(emailAutomationRules.id, id),
        eq(emailAutomationRules.userId, ctx.user.id)
      )
    )
    .returning();
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  invalidateAutomationCache(ctx.user.id);
  return NextResponse.json({ rule: row });
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
    .delete(emailAutomationRules)
    .where(
      and(
        eq(emailAutomationRules.id, id),
        eq(emailAutomationRules.userId, ctx.user.id)
      )
    )
    .returning({ id: emailAutomationRules.id });
  if (res.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  invalidateAutomationCache(ctx.user.id);
  return NextResponse.json({ ok: true });
}
