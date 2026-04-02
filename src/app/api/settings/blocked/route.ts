import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { blockedSenders } from "@/db/schema";
import { logError } from "@/lib/logger";
import { getAuthContext } from "@/lib/session";
import { parsePrimaryEmail } from "@/lib/mail-filter";

const postSchema = z.object({
  email: z.string().min(3).max(320),
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
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const normalized = parsePrimaryEmail(parsed.data.email);
  if (!normalized.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  try {
    const [row] = await getDb()
      .insert(blockedSenders)
      .values({ userId: ctx.user.id, email: normalized })
      .returning({
        id: blockedSenders.id,
        email: blockedSenders.email,
        createdAt: blockedSenders.createdAt,
      });
    return NextResponse.json({ blocked: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json(
        { error: "Already blocked." },
        { status: 409 }
      );
    }
    logError("settings_blocked_create_failed", { message: msg });
    return NextResponse.json(
      { error: "Could not add block." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const res = await getDb()
    .delete(blockedSenders)
    .where(
      and(eq(blockedSenders.id, id), eq(blockedSenders.userId, ctx.user.id))
    )
    .returning({ id: blockedSenders.id });
  if (res.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
