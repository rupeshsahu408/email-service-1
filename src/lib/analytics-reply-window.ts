import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { messages, type MessageFolder } from "@/db/schema";

type ThreadMsgRow = {
  threadId: string;
  folder: MessageFolder;
  createdAt: Date;
};

function firstSentAfter(
  incoming: ThreadMsgRow,
  sortedThread: ThreadMsgRow[]
): ThreadMsgRow | null {
  const t = incoming.createdAt.getTime();
  for (const s of sortedThread) {
    if (s.folder === "sent" && s.createdAt.getTime() > t) return s;
  }
  return null;
}

/**
 * Average reply latency for incoming mail in [windowStart, windowEnd] that got a sent reply.
 * Used for period-over-period comparison (one extra scoped thread load).
 */
export async function computeAverageReplyTimeMsForWindow(
  userId: string,
  windowStart: Date,
  windowEnd: Date
): Promise<{ averageReplyMs: number | null; sampleCount: number }> {
  const db = getDb();
  const threadRows = await db
    .select({ threadId: messages.threadId })
    .from(messages)
    .where(
      and(
        eq(messages.userId, userId),
        gte(messages.createdAt, windowStart),
        lte(messages.createdAt, windowEnd)
      )
    )
    .groupBy(messages.threadId);

  const threadIds = threadRows.map((r) => r.threadId);
  if (threadIds.length === 0) {
    return { averageReplyMs: null, sampleCount: 0 };
  }

  const rows = await db
    .select({
      threadId: messages.threadId,
      folder: messages.folder,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(and(eq(messages.userId, userId), inArray(messages.threadId, threadIds)))
    .orderBy(asc(messages.threadId), asc(messages.createdAt));

  const byThread = new Map<string, ThreadMsgRow[]>();
  for (const r of rows) {
    const list = byThread.get(r.threadId) ?? [];
    list.push(r);
    byThread.set(r.threadId, list);
  }

  const w0 = windowStart.getTime();
  const w1 = windowEnd.getTime();
  const replyTimesMs: number[] = [];

  for (const threadMsgs of byThread.values()) {
    const sorted = [...threadMsgs].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    for (const m of sorted) {
      if (m.folder === "sent") continue;
      const cr = m.createdAt.getTime();
      if (cr < w0 || cr > w1) continue;
      const reply = firstSentAfter(m, sorted);
      if (!reply) continue;
      replyTimesMs.push(reply.createdAt.getTime() - cr);
    }
  }

  if (replyTimesMs.length === 0) {
    return { averageReplyMs: null, sampleCount: 0 };
  }
  const sum = replyTimesMs.reduce((a, b) => a + b, 0);
  return {
    averageReplyMs: sum / replyTimesMs.length,
    sampleCount: replyTimesMs.length,
  };
}
