import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { labels, mailFilterRules } from "@/db/schema";
import { logError } from "@/lib/logger";
import { getAuthContext } from "@/lib/session";

const postSchema = z.object({
  fromMatch: z.string().min(1).max(320),
  action: z.enum(["trash", "label"]),
  labelId: z.string().uuid().optional(),
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
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  if (parsed.data.action === "label" && !parsed.data.labelId) {
    return NextResponse.json(
      { error: "Label rules need a label." },
      { status: 400 }
    );
  }
  if (parsed.data.labelId) {
    const owns = await getDb()
      .select({ id: labels.id })
      .from(labels)
      .where(
        and(eq(labels.id, parsed.data.labelId), eq(labels.userId, ctx.user.id))
      )
      .limit(1);
    if (owns.length === 0) {
      return NextResponse.json({ error: "Invalid label" }, { status: 400 });
    }
  }
  try {
    const [row] = await getDb()
      .insert(mailFilterRules)
      .values({
        userId: ctx.user.id,
        fromMatch: parsed.data.fromMatch.trim().toLowerCase(),
        action: parsed.data.action,
        labelId:
          parsed.data.action === "label" ? parsed.data.labelId ?? null : null,
      })
      .returning();
    return NextResponse.json({ rule: row });
  } catch (e) {
    logError("settings_filters_create_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json(
      { error: "Could not create filter rule." },
      { status: 500 }
    );
  }
}
