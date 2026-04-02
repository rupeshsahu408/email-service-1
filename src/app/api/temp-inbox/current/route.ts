import { NextResponse } from "next/server";
import { and, desc, eq, gt, gte, lt, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  messages,
  tempInboxAliases,
  tempInboxMessages,
  tempInboxUnclaimedMessages,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { requireTemporaryInboxPlan } from "@/lib/plan";
import { TEMP_INBOX_DAILY_MAX } from "@/lib/temp-inbox";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gate = requireTemporaryInboxPlan(user);
  if (gate !== true) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const now = new Date();

  // Cleanup expired aliases (cascade deletes messages).
  await getDb()
    .delete(tempInboxAliases)
    .where(
      and(eq(tempInboxAliases.userId, user.id), lte(tempInboxAliases.expiresAt, now))
    );

  // Cleanup expired unclaimed inbox messages.
  await getDb()
    .delete(tempInboxUnclaimedMessages)
    .where(lte(tempInboxUnclaimedMessages.expiresAt, now));

  const alias = await getDb()
    .select()
    .from(tempInboxAliases)
    .where(and(eq(tempInboxAliases.userId, user.id), gt(tempInboxAliases.expiresAt, now)))
    .orderBy(desc(tempInboxAliases.createdAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  // Catch-all: always try to claim the newest unclaimed temp inbox address
  // so OTPs for random `*@sendora.me` recipients show up immediately.
  const latestUnclaimed = await getDb()
    .select()
    .from(tempInboxUnclaimedMessages)
    .where(gt(tempInboxUnclaimedMessages.expiresAt, now))
    .orderBy(desc(tempInboxUnclaimedMessages.receivedAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  let effectiveAlias = alias;
  if (latestUnclaimed && (!effectiveAlias || effectiveAlias.emailAddress !== latestUnclaimed.emailAddress)) {
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
    if (dailyCount < TEMP_INBOX_DAILY_MAX) {
      const at = latestUnclaimed.emailAddress.indexOf("@");
      const localPart =
        at > 0
          ? latestUnclaimed.emailAddress.slice(0, at)
          : latestUnclaimed.emailAddress;

      try {
        await getDb().insert(tempInboxAliases).values({
          userId: user.id,
          localPart,
          emailAddress: latestUnclaimed.emailAddress.toLowerCase(),
          expiresAt: latestUnclaimed.expiresAt,
          expiryMinutes: Math.max(
            1,
            Math.round(
              (latestUnclaimed.expiresAt.getTime() - now.getTime()) / 60000
            )
          ),
        });
      } catch {
        // Unique collision; ignore.
      }
    }

    effectiveAlias = await getDb()
      .select()
      .from(tempInboxAliases)
      .where(
        and(
          eq(tempInboxAliases.userId, user.id),
          gt(tempInboxAliases.expiresAt, now)
        )
      )
      .orderBy(desc(tempInboxAliases.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null);
  }

  if (!effectiveAlias) {
    return NextResponse.json({ alias: null, messages: [] });
  }

  const claimedMessages = await getDb()
    .select({
      id: tempInboxMessages.id,
      receivedAt: tempInboxMessages.receivedAt,
      fromAddr: tempInboxMessages.fromAddr,
      subject: tempInboxMessages.subject,
      snippet: tempInboxMessages.snippet,
      otpCode: tempInboxMessages.otpCode,
      otpMatchedAt: tempInboxMessages.otpMatchedAt,
    })
    .from(tempInboxMessages)
    .where(
      and(
        eq(tempInboxMessages.userId, user.id),
        eq(tempInboxMessages.aliasId, effectiveAlias.id),
        gt(tempInboxMessages.expiresAt, now)
      )
    )
    .orderBy(desc(tempInboxMessages.receivedAt))
    .limit(50);

  const unclaimedMessages = await getDb()
    .select({
      id: tempInboxUnclaimedMessages.id,
      receivedAt: tempInboxUnclaimedMessages.receivedAt,
      fromAddr: tempInboxUnclaimedMessages.fromAddr,
      subject: tempInboxUnclaimedMessages.subject,
      snippet: tempInboxUnclaimedMessages.snippet,
      otpCode: tempInboxUnclaimedMessages.otpCode,
      otpMatchedAt: tempInboxUnclaimedMessages.otpMatchedAt,
    })
    .from(tempInboxUnclaimedMessages)
    .where(
      and(
        eq(tempInboxUnclaimedMessages.emailAddress, effectiveAlias.emailAddress),
        gt(tempInboxUnclaimedMessages.expiresAt, now)
      )
    )
    .orderBy(desc(tempInboxUnclaimedMessages.receivedAt))
    .limit(50);

  const regularInboxCountForAlias = await getDb()
    .select({ cnt: sql<number>`count(*)` })
    .from(messages)
    .where(
      and(
        eq(messages.userId, user.id),
        eq(messages.toAddr, effectiveAlias.emailAddress),
        eq(messages.folder, "inbox")
      )
    )
    .then((rows) => Number(rows[0]?.cnt ?? 0));

  const merged = [...claimedMessages, ...unclaimedMessages].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );

  const remainingMs = effectiveAlias.expiresAt.getTime() - now.getTime();

  return NextResponse.json({
    alias: {
      id: effectiveAlias.id,
      emailAddress: effectiveAlias.emailAddress,
      expiresAt: effectiveAlias.expiresAt.toISOString(),
      expiryMinutes: effectiveAlias.expiryMinutes,
      remainingMs,
    },
    messages: merged,
    _debug: {
      claimedFetched: claimedMessages.length,
      unclaimedFetched: unclaimedMessages.length,
      latestUnclaimed: unclaimedMessages[0] ?? null,
      regularInboxCountForAlias,
    },
  });
}

