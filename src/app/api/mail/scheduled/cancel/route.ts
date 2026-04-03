import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { scheduledEmails } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

const cancelSchema = z.object({
  id: z.string().uuid(),
});

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

  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { id } = parsed.data;

  await getDb()
    .update(scheduledEmails)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(
      and(
        eq(scheduledEmails.id, id),
        eq(scheduledEmails.userId, user.id),
        eq(scheduledEmails.status, "scheduled")
      )
    );

  return NextResponse.json({ ok: true });
}

