import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { automationWorkflows } from "@/db/schema";
import { parseAutomationActions, parseAutomationConditions } from "@/lib/automation-validate";
import { invalidateAutomationCache } from "@/lib/email-automation";
import { getAuthContext } from "@/lib/session";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  name: z.string().max(128).optional(),
  enabled: z.boolean().optional(),
  triggerConditions: z.unknown(),
  steps: z.unknown(),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await getDb()
    .select()
    .from(automationWorkflows)
    .where(eq(automationWorkflows.userId, ctx.user.id))
    .orderBy(desc(automationWorkflows.createdAt));
  return NextResponse.json({ workflows: rows });
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
  const triggerConditions = parseAutomationConditions(
    parsed.data.triggerConditions
  );
  const steps = parseAutomationActions(parsed.data.steps);
  if (!triggerConditions || !steps) {
    return NextResponse.json(
      { error: "Invalid triggerConditions or steps" },
      { status: 400 }
    );
  }
  const [row] = await getDb()
    .insert(automationWorkflows)
    .values({
      userId: ctx.user.id,
      name: parsed.data.name?.trim() ?? "",
      enabled: parsed.data.enabled ?? true,
      triggerConditions,
      steps,
    })
    .returning();
  invalidateAutomationCache(ctx.user.id);
  return NextResponse.json({ workflow: row });
}
