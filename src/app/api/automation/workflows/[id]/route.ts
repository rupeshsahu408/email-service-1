import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { automationWorkflows } from "@/db/schema";
import { parseAutomationActions, parseAutomationConditions } from "@/lib/automation-validate";
import { invalidateAutomationCache } from "@/lib/email-automation";
import { getAuthContext } from "@/lib/session";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().max(128).optional(),
  enabled: z.boolean().optional(),
  triggerConditions: z.unknown().optional(),
  steps: z.unknown().optional(),
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
  if (parsed.data.triggerConditions !== undefined) {
    const c = parseAutomationConditions(parsed.data.triggerConditions);
    if (!c) {
      return NextResponse.json(
        { error: "Invalid triggerConditions" },
        { status: 400 }
      );
    }
    patch.triggerConditions = c;
  }
  if (parsed.data.steps !== undefined) {
    const s = parseAutomationActions(parsed.data.steps);
    if (!s) {
      return NextResponse.json({ error: "Invalid steps" }, { status: 400 });
    }
    patch.steps = s;
  }

  const [row] = await getDb()
    .update(automationWorkflows)
    .set(patch as typeof automationWorkflows.$inferInsert)
    .where(
      and(
        eq(automationWorkflows.id, id),
        eq(automationWorkflows.userId, ctx.user.id)
      )
    )
    .returning();
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  invalidateAutomationCache(ctx.user.id);
  return NextResponse.json({ workflow: row });
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
    .delete(automationWorkflows)
    .where(
      and(
        eq(automationWorkflows.id, id),
        eq(automationWorkflows.userId, ctx.user.id)
      )
    )
    .returning({ id: automationWorkflows.id });
  if (res.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  invalidateAutomationCache(ctx.user.id);
  return NextResponse.json({ ok: true });
}
