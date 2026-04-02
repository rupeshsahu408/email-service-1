import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { formatUserEmail } from "@/lib/constants";
import { parsePrimaryEmail } from "@/lib/mail-filter";

export type UserAnalyticsRange = "today" | "7d" | "30d";

/** Start of UTC calendar day (matches admin charts). */
export function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function getUserAnalyticsTimeRange(
  range: UserAnalyticsRange,
  now = new Date()
): { start: Date; end: Date } {
  const todayStart = utcDayStart(now);
  const end = now;
  if (range === "today") {
    return { start: todayStart, end };
  }
  if (range === "7d") {
    const start = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
    return { start, end };
  }
  const start = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { start, end };
}

const INCOMING_FOLDERS = ["inbox", "archive", "spam"] as const;

function enumerateUtcDaysInclusive(start: Date, end: Date): string[] {
  const keys: string[] = [];
  let d = utcDayStart(start);
  const last = utcDayStart(end);
  while (d <= last) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    keys.push(`${y}-${m}-${day}`);
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return keys;
}

export type UserAnalyticsPayload = {
  range: UserAnalyticsRange;
  start: string;
  end: string;
  summary: {
    emailsReceived: number;
    emailsSent: number;
    spamEmails: number;
    contactsCount: number;
  };
  series: Array<{ day: string; received: number; sent: number }>;
  topContacts: Array<{ email: string; messageCount: number }>;
  mostActiveSender: { email: string; messageCount: number } | null;
};

export async function getUserAnalytics(
  userId: string,
  userLocalPart: string,
  range: UserAnalyticsRange
): Promise<UserAnalyticsPayload> {
  const { start, end } = getUserAnalyticsTimeRange(range);
  const selfEmail = formatUserEmail(userLocalPart).toLowerCase();
  const db = getDb();

  const msgDayUtc = sql`(${messages.createdAt} AT TIME ZONE 'UTC')::date`;

  const baseTime = and(
    eq(messages.userId, userId),
    gte(messages.createdAt, start),
    lte(messages.createdAt, end)
  );

  const [
    receivedRow,
    sentRow,
    spamRow,
    dailyRecv,
    dailySent,
    incomingByFrom,
    outgoingByTo,
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(messages)
      .where(and(baseTime, inArray(messages.folder, [...INCOMING_FOLDERS]))),
    db
      .select({ n: count() })
      .from(messages)
      .where(and(baseTime, eq(messages.folder, "sent"))),
    db
      .select({ n: count() })
      .from(messages)
      .where(and(baseTime, eq(messages.folder, "spam"))),
    db
      .select({
        day: sql<string>`to_char(${msgDayUtc}, 'YYYY-MM-DD')`,
        c: count(),
      })
      .from(messages)
      .where(and(baseTime, inArray(messages.folder, [...INCOMING_FOLDERS])))
      .groupBy(msgDayUtc)
      .orderBy(msgDayUtc),
    db
      .select({
        day: sql<string>`to_char(${msgDayUtc}, 'YYYY-MM-DD')`,
        c: count(),
      })
      .from(messages)
      .where(and(baseTime, eq(messages.folder, "sent")))
      .groupBy(msgDayUtc)
      .orderBy(msgDayUtc),
    db
      .select({
        fromAddr: messages.fromAddr,
        n: count(),
      })
      .from(messages)
      .where(and(baseTime, inArray(messages.folder, [...INCOMING_FOLDERS])))
      .groupBy(messages.fromAddr),
    db
      .select({
        toAddr: messages.toAddr,
        n: count(),
      })
      .from(messages)
      .where(and(baseTime, eq(messages.folder, "sent")))
      .groupBy(messages.toAddr),
  ]);

  const recvMap = new Map<string, number>();
  for (const row of dailyRecv) {
    recvMap.set(row.day, Number(row.c));
  }
  const sentMap = new Map<string, number>();
  for (const row of dailySent) {
    sentMap.set(row.day, Number(row.c));
  }

  const dayKeys = enumerateUtcDaysInclusive(start, end);
  const series = dayKeys.map((day) => ({
    day,
    received: recvMap.get(day) ?? 0,
    sent: sentMap.get(day) ?? 0,
  }));

  const contactActivity = new Map<string, number>();
  for (const row of incomingByFrom) {
    const e = parsePrimaryEmail(row.fromAddr);
    if (!e || e === selfEmail) continue;
    const n = Number(row.n);
    contactActivity.set(e, (contactActivity.get(e) ?? 0) + n);
  }
  for (const row of outgoingByTo) {
    const e = parsePrimaryEmail(row.toAddr);
    if (!e || e === selfEmail) continue;
    const n = Number(row.n);
    contactActivity.set(e, (contactActivity.get(e) ?? 0) + n);
  }

  const topContacts = [...contactActivity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([email, messageCount]) => ({ email, messageCount }));

  const senderOnly = new Map<string, number>();
  for (const row of incomingByFrom) {
    const e = parsePrimaryEmail(row.fromAddr);
    if (!e || e === selfEmail) continue;
    const n = Number(row.n);
    senderOnly.set(e, (senderOnly.get(e) ?? 0) + n);
  }
  let mostActiveSender: { email: string; messageCount: number } | null = null;
  for (const [email, messageCount] of senderOnly) {
    if (!mostActiveSender || messageCount > mostActiveSender.messageCount) {
      mostActiveSender = { email, messageCount };
    }
  }

  return {
    range,
    start: start.toISOString(),
    end: end.toISOString(),
    summary: {
      emailsReceived: Number(receivedRow[0]?.n ?? 0),
      emailsSent: Number(sentRow[0]?.n ?? 0),
      spamEmails: Number(spamRow[0]?.n ?? 0),
      contactsCount: contactActivity.size,
    },
    series,
    topContacts,
    mostActiveSender,
  };
}
