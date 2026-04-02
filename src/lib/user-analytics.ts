import { and, asc, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { messages, type MessageFolder } from "@/db/schema";
import { fetchHourlyActivityUtcBuckets } from "@/lib/analytics-hourly-utc";
import { computePhase3Analytics, type Phase3Payload } from "@/lib/analytics-phase3";
import {
  computePhase4Insights,
  type Phase4Payload,
} from "@/lib/analytics-phase4-insights";
import { computeAverageReplyTimeMsForWindow } from "@/lib/analytics-reply-window";
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

export type ReplyInsightSample = {
  delayMs: number;
  incomingHourUtc: number;
  replyHourUtc: number;
};

function emptyPhase2(nowIso: string) {
  return {
    replyInsightSamples: [] as ReplyInsightSample[],
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
      pendingOver48HoursCount: 0,
      pendingOver3DaysCount: 0,
      delayedInboxRepliesOver48h: 0,
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
  const replyInsightSamples: ReplyInsightSample[] = [];
  const MAX_REPLY_SAMPLES = 300;
  let delayedInboxRepliesOver48h = 0;
  const MS_HOUR = 3600000;
  const MS_48H = 48 * MS_HOUR;
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
          const delayMs = reply.createdAt.getTime() - cr.getTime();
          replyTimesMs.push(delayMs);
          repliedEmailsCount += 1;
          if (m.folder === "inbox" && delayMs > MS_48H) {
            delayedInboxRepliesOver48h += 1;
          }
          if (replyInsightSamples.length < MAX_REPLY_SAMPLES) {
            replyInsightSamples.push({
              delayMs,
              incomingHourUtc: m.createdAt.getUTCHours(),
              replyHourUtc: reply.createdAt.getUTCHours(),
            });
          }
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
  const pendingOver48HoursCount = pendingInbox.filter(
    (m) => now.getTime() - m.createdAt.getTime() > 2 * MS_DAY
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
    replyInsightSamples,
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
      pendingOver48HoursCount,
      pendingOver3DaysCount,
      delayedInboxRepliesOver48h,
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
    pendingOver48HoursCount: number;
    pendingOver3DaysCount: number;
    delayedInboxRepliesOver48h: number;
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
  phase4: Phase4Payload;
};

export type GetUserAnalyticsOptions = {
  useAiCategories?: boolean;
};

export async function getUserAnalytics(
  userId: string,
  userLocalPart: string,
  range: UserAnalyticsRange,
  options?: GetUserAnalyticsOptions
): Promise<UserAnalyticsPayload> {
  const now = new Date();
  const { start, end } = getUserAnalyticsTimeRange(range, now);
  const windowMs = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - windowMs);
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
    hourlyActivityUtc,
    prevReplyWindow,
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
    computePhase3Analytics(userId, selfEmail, start, end, {
      useAiCategories: options?.useAiCategories === true,
    }),
    fetchHourlyActivityUtcBuckets(userId, start, end),
    range !== "today"
      ? computeAverageReplyTimeMsForWindow(userId, prevStart, start)
      : Promise.resolve({ averageReplyMs: null as number | null, sampleCount: 0 }),
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

  const domainTotals = new Map<string, number>();
  for (const row of incomingByFrom) {
    const e = parsePrimaryEmail(row.fromAddr);
    if (!e || !e.includes("@") || e === selfEmail) continue;
    const dom = e.slice(e.indexOf("@") + 1).toLowerCase();
    if (!dom) continue;
    domainTotals.set(dom, (domainTotals.get(dom) ?? 0) + Number(row.n));
  }
  const incomingByDomain = [...domainTotals.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);

  const phase4 = computePhase4Insights({
    range,
    emailsReceived: Number(receivedRow[0]?.n ?? 0),
    averageReplyTimeMs: phase2.response.averageReplyTimeMs,
    hasReplySamples: phase2.response.hasReplySamples,
    actionInsights: {
      waitingForReplyCount: phase2.actionInsights.waitingForReplyCount,
      pendingOver24HoursCount: phase2.actionInsights.pendingOver24HoursCount,
      pendingOver48HoursCount: phase2.actionInsights.pendingOver48HoursCount,
      pendingOver3DaysCount: phase2.actionInsights.pendingOver3DaysCount,
      delayedInboxRepliesOver48h: phase2.actionInsights.delayedInboxRepliesOver48h,
    },
    phase3,
    replyInsightSamples: phase2.replyInsightSamples,
    hourlyActivityUtc,
    incomingByDomain,
    previousAverageReplyMs: prevReplyWindow.averageReplyMs,
  });

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
    phase4,
  };
}
