import { and, count, eq, gte, lte, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { messages } from "@/db/schema";

const msgHourUtc = sql<number>`(EXTRACT(HOUR FROM (${messages.createdAt} AT TIME ZONE 'UTC')))::int`;

/** 24 buckets [0..23], message counts excluding trash, for the given range. */
export async function fetchHourlyActivityUtcBuckets(
  userId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<number[]> {
  const db = getDb();
  const rows = await db
    .select({
      hr: msgHourUtc,
      c: count(),
    })
    .from(messages)
    .where(
      and(
        eq(messages.userId, userId),
        gte(messages.createdAt, rangeStart),
        lte(messages.createdAt, rangeEnd),
        ne(messages.folder, "trash")
      )
    )
    .groupBy(msgHourUtc)
    .orderBy(msgHourUtc);

  const out = Array.from({ length: 24 }, () => 0);
  for (const r of rows) {
    const h = Number(r.hr);
    if (Number.isFinite(h) && h >= 0 && h < 24) {
      out[h] = Number(r.c);
    }
  }
  return out;
}
