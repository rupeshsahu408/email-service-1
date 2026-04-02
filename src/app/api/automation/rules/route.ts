import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { emailAutomationRules } from "@/db/schema";
import { parseAutomationActions, parseAutomationConditions } from "@/lib/automation-validate";
import { invalidateAutomationCache } from "@/lib/email-automation";
import { getAuthContext } from "@/lib/session";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  name: z.string().max(128).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  conditions: z.unknown(),
  actions: z.unknown(),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await getDb()
    .select()
    .from(emailAutomationRules)
    .where(eq(emailAutomationRules.userId, ctx.user.id))
    .orderBy(
      asc(emailAutomationRules.sortOrder),
      desc(emailAutomationRules.createdAt)
    );
  return NextResponse.json({ rules: rows });
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
  const conditions = parseAutomationConditions(parsed.data.conditions);
  const actions = parseAutomationActions(parsed.data.actions);
  if (!conditions || !actions) {
    return NextResponse.json(
      { error: "Invalid conditions or actions" },
      { status: 400 }
    );
  }
  const [row] = await getDb()
    .insert(emailAutomationRules)
    .values({
      userId: ctx.user.id,
      name: parsed.data.name?.trim() ?? "",
      enabled: parsed.data.enabled ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
      conditions,
      actions,
    })
    .returning();
  invalidateAutomationCache(ctx.user.id);
  return NextResponse.json({ rule: row });
}
