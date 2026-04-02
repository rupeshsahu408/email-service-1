import { NextResponse } from "next/server";
import { and, count, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  try {
    const [inboxRow, spamRow, inboxUnreadRow] = await Promise.all([
      db
        .select({ n: count() })
        .from(messages)
        .where(and(eq(messages.userId, user.id), eq(messages.folder, "inbox"))),
      db
        .select({ n: count() })
        .from(messages)
        .where(and(eq(messages.userId, user.id), eq(messages.folder, "spam"))),
      db
        .select({ n: count() })
        .from(messages)
        .where(
          and(
            eq(messages.userId, user.id),
            eq(messages.folder, "inbox"),
            isNull(messages.readAt)
          )
        ),
    ]);

    return NextResponse.json({
      inbox: Number(inboxRow[0]?.n ?? 0),
      spam: Number(spamRow[0]?.n ?? 0),
      inboxUnread: Number(inboxUnreadRow[0]?.n ?? 0),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not load counts" },
      { status: 500 }
    );
  }
}
