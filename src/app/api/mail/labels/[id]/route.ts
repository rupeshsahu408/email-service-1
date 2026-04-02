import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { labels } from "@/db/schema";
import { logError } from "@/lib/logger";
import { getCurrentUser } from "@/lib/session";

const patchSchema = z.object({
  name: z.string().min(1).max(64).trim().optional(),
  color: z
    .union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.literal(""), z.null()])
    .optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
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
  const patch: { name?: string; color?: string | null } = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.color !== undefined) {
    patch.color =
      parsed.data.color === "" || parsed.data.color === null
        ? null
        : parsed.data.color;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }
  try {
    const [row] = await getDb()
      .update(labels)
      .set(patch)
      .where(and(eq(labels.id, id), eq(labels.userId, user.id)))
      .returning({
        id: labels.id,
        name: labels.name,
        color: labels.color,
        createdAt: labels.createdAt,
      });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ label: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json(
        { error: "That label name is already in use." },
        { status: 409 }
      );
    }
    logError("mail_labels_patch_failed", { message: msg });
    return NextResponse.json(
      { error: "Could not update label." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const res = await getDb()
    .delete(labels)
    .where(and(eq(labels.id, id), eq(labels.userId, user.id)))
    .returning({ id: labels.id });
  if (res.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
