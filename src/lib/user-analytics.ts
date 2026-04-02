import { and, asc, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { messages, type MessageFolder } from "@/db/schema";
import { computePhase3Analytics, type Phase3Payload } from "@/lib/analytics-phase3";
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

type ThreadMsgRow = {
  id: string;
  threadId: string;
  folder: MessageFolder;
  createdAt: Date;
  readAt: Date | null;
  subject: string;
  fromAddr: string;
};

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

function emptyPhase2(nowIso: string) {
  return {
    response: {
      averageReplyTimeMs: null as number | null,
      fastestReplyTimeMs: null as number | null,
      slowestReplyTimeMs: null as number | null,
      totalPendingReplies: 0,
      hasReplySamples: false,
    },
    productivity: {
      inboxClearedPercentage: null as number | null,
      unreadEmailsCount: 0,
      repliedEmailsCount: 0,
      archivedOrTrashedEmailsCount: 0,
    },
    actionInsights: {
      waitingForReplyCount: 0,
      pendingOver24HoursCount: 0,
      pendingOver3DaysCount: 0,
      pendingEmails: [] as Array<{
        id: string;
        threadId: string;
        subject: string;
        fromAddr: string;
        createdAt: string;
      }>,
    },
    phase2ComputedAt: nowIso,
  };
}

function firstUserReplyAfter(
  incoming: ThreadMsgRow,
  sortedThread: ThreadMsgRow[]
): ThreadMsgRow | null {
  const t = incoming.createdAt.getTime();
  for (const s of sortedThread) {
    if (s.folder === "sent" && s.createdAt.getTime() > t) {
      return s;
    }
  }
  return null;
}

function analyzePhase2ThreadData(
  rows: ThreadMsgRow[],
  rangeStart: Date,
  rangeEnd: Date,
  now: Date
) {
  const byThread = new Map<string, ThreadMsgRow[]>();
  for (const r of rows) {
    const list = byThread.get(r.threadId) ?? [];
    list.push(r);
    byThread.set(r.threadId, list);
  }

  const inAnalyticsRange = (d: Date) => {
    const t = d.getTime();
    return t >= rangeStart.getTime() && t <= rangeEnd.getTime();
  };

  const replyTimesMs: number[] = [];
  let repliedEmailsCount = 0;
  let unreadEmailsCount = 0;
  let archivedOrTrashedEmailsCount = 0;
  let attentionTotal = 0;
  let attentionCleared = 0;
  const pendingInbox: ThreadMsgRow[] = [];

  for (const threadMsgs of byThread.values()) {
    const sorted = [...threadMsgs].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    for (const m of sorted) {
      if (m.folder === "sent") continue;

      const reply = firstUserReplyAfter(m, sorted);
      const cr = m.createdAt;

      if (inAnalyticsRange(cr)) {
        if (reply) {
          replyTimesMs.push(reply.createdAt.getTime() - cr.getTime());
          repliedEmailsCount += 1;
        }

        if (m.folder === "inbox" && m.readAt === null) {
          unreadEmailsCount += 1;
        }

        if (m.folder === "archive" || m.folder === "trash") {
          archivedOrTrashedEmailsCount += 1;
        }

        if (
          m.folder === "inbox" ||
          m.folder === "archive" ||
          m.folder === "trash"
        ) {
          attentionTotal += 1;
          const cleared =
            m.readAt !== null ||
            m.folder !== "inbox" ||
            reply !== null;
          if (cleared) attentionCleared += 1;
        }

        if (m.folder === "inbox" && !reply) {
          pendingInbox.push(m);
        }
      }
    }
  }

  pendingInbox.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const pendingEmails = pendingInbox.slice(0, 50).map((m) => ({
    id: m.id,
    threadId: m.threadId,
    subject: m.subject?.trim() ? m.subject : "(No subject)",
    fromAddr: m.fromAddr,
    createdAt: m.createdAt.toISOString(),
  }));

  const MS_DAY = 86400000;
  const pendingOver24HoursCount = pendingInbox.filter(
    (m) => now.getTime() - m.createdAt.getTime() > MS_DAY
  ).length;
  const pendingOver3DaysCount = pendingInbox.filter(
    (m) => now.getTime() - m.createdAt.getTime() > 3 * MS_DAY
  ).length;

  const avg =
    replyTimesMs.length > 0
      ? replyTimesMs.reduce((a, b) => a + b, 0) / replyTimesMs.length
      : null;
  const fastest =
    replyTimesMs.length > 0 ? Math.min(...replyTimesMs) : null;
  const slowest =
    replyTimesMs.length > 0 ? Math.max(...replyTimesMs) : null;

  const inboxClearedPercentage =
    attentionTotal > 0
      ? Math.round((1000 * attentionCleared) / attentionTotal) / 10
      : null;

  return {
    response: {
      averageReplyTimeMs: avg,
      fastestReplyTimeMs: fastest,
      slowestReplyTimeMs: slowest,
      totalPendingReplies: pendingInbox.length,
      hasReplySamples: replyTimesMs.length > 0,
    },
    productivity: {
      inboxClearedPercentage,
      unreadEmailsCount,
      repliedEmailsCount,
      archivedOrTrashedEmailsCount,
    },
    actionInsights: {
      waitingForReplyCount: pendingInbox.length,
      pendingOver24HoursCount,
      pendingOver3DaysCount,
      pendingEmails,
    },
    phase2ComputedAt: now.toISOString(),
  };
}

async function computePhase2Block(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date,
  now: Date
) {
  const db = getDb();
  const threadRows = await db
    .select({ threadId: messages.threadId })
    .from(messages)
    .where(
      and(
        eq(messages.userId, userId),
        gte(messages.createdAt, rangeStart),
        lte(messages.createdAt, rangeEnd)
      )
    )
    .groupBy(messages.threadId);

  const threadIds = threadRows.map((r) => r.threadId);
  if (threadIds.length === 0) {
    return emptyPhase2(now.toISOString());
  }

  const rows = await db
    .select({
      id: messages.id,
      threadId: messages.threadId,
      folder: messages.folder,
      createdAt: messages.createdAt,
      readAt: messages.readAt,
      subject: messages.subject,
      fromAddr: messages.fromAddr,
    })
    .from(messages)
    .where(and(eq(messages.userId, userId), inArray(messages.threadId, threadIds)))
    .orderBy(asc(messages.threadId), asc(messages.createdAt));

  return analyzePhase2ThreadData(rows, rangeStart, rangeEnd, now);
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
  response: {
    averageReplyTimeMs: number | null;
    fastestReplyTimeMs: number | null;
    slowestReplyTimeMs: number | null;
    totalPendingReplies: number;
    hasReplySamples: boolean;
  };
  productivity: {
    inboxClearedPercentage: number | null;
    unreadEmailsCount: number;
    repliedEmailsCount: number;
    archivedOrTrashedEmailsCount: number;
  };
  actionInsights: {
    waitingForReplyCount: number;
    pendingOver24HoursCount: number;
    pendingOver3DaysCount: number;
    pendingEmails: Array<{
      id: string;
      threadId: string;
      subject: string;
      fromAddr: string;
      createdAt: string;
    }>;
  };
  phase2ComputedAt: string;
  phase3: Phase3Payload;
};

export async function getUserAnalytics(
  userId: string,
  userLocalPart: string,
  range: UserAnalyticsRange
): Promise<UserAnalyticsPayload> {
  const now = new Date();
  const { start, end } = getUserAnalyticsTimeRange(range, now);
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
    phase2,
    phase3,
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
    computePhase2Block(userId, start, end, now),
    computePhase3Analytics(userId, selfEmail, start, end),
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
    response: phase2.response,
    productivity: phase2.productivity,
    actionInsights: phase2.actionInsights,
    phase2ComputedAt: phase2.phase2ComputedAt,
    phase3,
  };
}
