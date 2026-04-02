import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { importantContacts } from "@/db/schema";
import { invalidateAutomationCache } from "@/lib/email-automation";
import { getAuthContext } from "@/lib/session";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  pattern: z.string().min(1).max(320),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await getDb()
    .select()
    .from(importantContacts)
    .where(eq(importantContacts.userId, ctx.user.id))
    .orderBy(desc(importantContacts.createdAt));
  return NextResponse.json({ contacts: rows });
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
  try {
    const [row] = await getDb()
      .insert(importantContacts)
      .values({
        userId: ctx.user.id,
        pattern: parsed.data.pattern.trim().toLowerCase(),
      })
      .returning();
    invalidateAutomationCache(ctx.user.id);
    return NextResponse.json({ contact: row });
  } catch {
    return NextResponse.json(
      { error: "Could not add (duplicate?)" },
      { status: 400 }
    );
  }
}
