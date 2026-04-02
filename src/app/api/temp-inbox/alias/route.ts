import { NextResponse } from "next/server";
import { and, eq, gte, lt, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { tempInboxAliases } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import {
  expiryOptionToMinutes,
  generateTempLocalPart,
  TEMP_INBOX_DAILY_MAX,
  type TempInboxExpiryOption,
} from "@/lib/temp-inbox";
import { requireTemporaryInboxPlan } from "@/lib/plan";

const aliasBodySchema = z.object({
  expiryOption: z.enum(["10m", "1h"]).default("10m"),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gate = requireTemporaryInboxPlan(user);
  if (gate !== true) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = aliasBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const expiryOption = parsed.data.expiryOption as TempInboxExpiryOption;
  const expiryMinutes = expiryOptionToMinutes(expiryOption);
  const now = new Date();

  // Cleanup expired aliases (cascade deletes messages).
  await getDb()
    .delete(tempInboxAliases)
    .where(
      and(eq(tempInboxAliases.userId, user.id), lte(tempInboxAliases.expiresAt, now))
    );

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const dailyCountRow = await getDb()
    .select({ cnt: sql<number>`count(*)` })
    .from(tempInboxAliases)
    .where(
      and(
        eq(tempInboxAliases.userId, user.id),
        gte(tempInboxAliases.createdAt, startOfDay),
        lt(tempInboxAliases.createdAt, endOfDay)
      )
    )
    .then((rows) => rows[0] ?? { cnt: 0 });

  const dailyCount = Number(dailyCountRow.cnt ?? 0);
  if (dailyCount >= TEMP_INBOX_DAILY_MAX) {
    return NextResponse.json(
      { error: `Daily limit reached. Max ${TEMP_INBOX_DAILY_MAX} temporary inboxes per day.` },
      { status: 429 }
    );
  }

  const emailDomain = process.env.EMAIL_DOMAIN ?? "localhost.test";

  // Try a few times to avoid rare unique collisions.
  for (let attempt = 0; attempt < 6; attempt++) {
    const localPart = generateTempLocalPart(6);
    const emailAddress = `${localPart}@${emailDomain}`.toLowerCase();
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);

    try {
      const inserted = await getDb()
        .insert(tempInboxAliases)
        .values({
          userId: user.id,
          localPart,
          emailAddress,
          expiresAt,
          expiryMinutes,
        })
        .returning({ id: tempInboxAliases.id });

      const id = inserted[0]!.id;
      return NextResponse.json({
        alias: {
          id,
          emailAddress,
          expiresAt: expiresAt.toISOString(),
          expiryMinutes,
          remainingMs: expiresAt.getTime() - now.getTime(),
        },
      });
    } catch {
      // Likely unique collision. Retry with a new alias.
    }
  }

  return NextResponse.json(
    { error: "Could not generate a temporary inbox. Please try again." },
    { status: 500 }
  );
}

