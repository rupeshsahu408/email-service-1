import { NextResponse } from "next/server";
import { asc, and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { scheduledEmails } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

/**
 * List upcoming scheduled sends for the signed-in user.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getDb()
    .select({
      id: scheduledEmails.id,
      toAddr: scheduledEmails.toAddr,
      ccAddr: scheduledEmails.ccAddr,
      bccAddr: scheduledEmails.bccAddr,
      subject: scheduledEmails.subject,
      sendAt: scheduledEmails.sendAt,
      status: scheduledEmails.status,
      createdAt: scheduledEmails.createdAt,
    })
    .from(scheduledEmails)
    .where(
      and(
        eq(scheduledEmails.userId, user.id),
        eq(scheduledEmails.status, "scheduled")
      )
    )
    .orderBy(asc(scheduledEmails.sendAt));

  return NextResponse.json({
    jobs: rows.map((r) => ({
      id: r.id,
      toAddr: r.toAddr,
      ccAddr: r.ccAddr,
      bccAddr: r.bccAddr,
      subject: r.subject,
      sendAt: r.sendAt.toISOString(),
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
