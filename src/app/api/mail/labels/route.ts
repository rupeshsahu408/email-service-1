import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { labels } from "@/db/schema";
import { logError } from "@/lib/logger";
import { getCurrentUser } from "@/lib/session";

const createSchema = z.object({
  name: z.string().min(1).max(64).trim(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await getDb()
    .select({
      id: labels.id,
      name: labels.name,
      color: labels.color,
      createdAt: labels.createdAt,
    })
    .from(labels)
    .where(eq(labels.userId, user.id))
    .orderBy(desc(labels.createdAt));
  return NextResponse.json({ labels: rows });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  try {
    const [row] = await getDb()
      .insert(labels)
      .values({ userId: user.id, name: parsed.data.name })
      .returning({
        id: labels.id,
        name: labels.name,
        color: labels.color,
        createdAt: labels.createdAt,
      });
    return NextResponse.json({ label: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return NextResponse.json(
        { error: "A label with this name already exists." },
        { status: 409 }
      );
    }
    logError("mail_labels_create_failed", { message: msg });
    return NextResponse.json(
      { error: "Could not create label." },
      { status: 500 }
    );
  }
}
