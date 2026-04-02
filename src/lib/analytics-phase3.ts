import { and, eq, gte, lte, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import {
  classifyEmailForAnalytics,
  type EmailAnalyticsCategory,
} from "@/lib/email-analytics-category";

export type RelationshipStrength = "strong" | "medium" | "low";

function relationshipScore(recv: number, sent: number): RelationshipStrength {
  const t = recv + sent;
  if (recv >= 2 && sent >= 2 && t >= 6) return "strong";
  if (t >= 3) return "medium";
  return "low";
}

export type Phase3ContactRow = {
  email: string;
  interactionCount: number;
  receivedInRange: number;
  sentInRange: number;
  relationshipScore: RelationshipStrength;
};

export type Phase3Payload = {
  contactIntelligence: {
    topContacts: Phase3ContactRow[];
    newContactsCount: number;
    inactiveContactsCount: number;
    mostActiveSender: { email: string; messageCount: number } | null;
    mostActiveRecipient: { email: string; messageCount: number } | null;
  };
  categories: {
    business: number;
    personal: number;
    finance: number;
    spam: number;
    total: number;
    topCategory: EmailAnalyticsCategory | null;
    topCategoryPercentage: number | null;
    insightLine: string;
  };
  phase3ComputedAt: string;
};

function coerceRow(r: Record<string, unknown>): {
  partner_email: string;
  first_seen: Date;
  last_seen: Date;
  in_range_total: number;
  recv_in_range: number;
  sent_in_range: number;
} | null {
  const email = String(r.partner_email ?? "").toLowerCase().trim();
  if (!email || !email.includes("@")) return null;
  const fs = r.first_seen;
  const ls = r.last_seen;
  return {
    partner_email: email,
    first_seen: fs instanceof Date ? fs : new Date(String(fs)),
    last_seen: ls instanceof Date ? ls : new Date(String(ls)),
    in_range_total: Number(r.in_range_total ?? 0),
    recv_in_range: Number(r.recv_in_range ?? 0),
    sent_in_range: Number(r.sent_in_range ?? 0),
  };
}

function pickMaxByCount(
  rows: Array<{ email: string; count: number }>
): { email: string; messageCount: number } | null {
  if (rows.length === 0) return null;
  rows.sort((a, b) =>
    b.count !== a.count
      ? b.count - a.count
      : a.email.localeCompare(b.email)
  );
  const top = rows[0]!;
  if (top.count <= 0) return null;
  return { email: top.email, messageCount: top.count };
}

function emptyPhase3(reason: string): Phase3Payload {
  const now = new Date().toISOString();
  return {
    contactIntelligence: {
      topContacts: [],
      newContactsCount: 0,
      inactiveContactsCount: 0,
      mostActiveSender: null,
      mostActiveRecipient: null,
    },
    categories: {
      business: 0,
      personal: 0,
      finance: 0,
      spam: 0,
      total: 0,
      topCategory: null,
      topCategoryPercentage: null,
      insightLine: reason,
    },
    phase3ComputedAt: now,
  };
}

export async function computePhase3Analytics(
  userId: string,
  selfEmailLower: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<Phase3Payload> {
  try {
    return await computePhase3AnalyticsCore(
      userId,
      selfEmailLower,
      rangeStart,
      rangeEnd
    );
  } catch {
    return emptyPhase3(
      "Contact and category analytics could not be loaded. Try again later."
    );
  }
}

async function computePhase3AnalyticsCore(
  userId: string,
  selfEmailLower: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<Phase3Payload> {
  const nowIso = new Date().toISOString();
  const db = getDb();

  const aggRaw = await db.execute(sql`
    WITH partner_events AS (
      SELECT
        m.created_at AS created_at,
        m.folder AS folder,
        CASE WHEN m.folder = 'sent' THEN
          lower(trim(both from coalesce(
            (regexp_match(
              lower(trim(both from coalesce(m.to_addr, ''))),
              '<([^>]+@[^>]+)>'
            ))[1],
            trim(both from coalesce(m.to_addr, ''))
          )))
        ELSE
          lower(trim(both from coalesce(
            (regexp_match(
              lower(trim(both from coalesce(m.from_addr, ''))),
              '<([^>]+@[^>]+)>'
            ))[1],
            trim(both from coalesce(m.from_addr, ''))
          )))
        END AS partner_email
      FROM messages m
      WHERE m.user_id = ${userId}::uuid
        AND m.folder <> 'trash'
        AND m.created_at <= ${rangeEnd.toISOString()}::timestamptz
        AND (
          (m.folder <> 'sent' AND coalesce(trim(both from m.from_addr), '') <> '')
          OR (m.folder = 'sent' AND coalesce(trim(both from m.to_addr), '') <> '')
        )
    ),
    clean AS (
      SELECT created_at, folder, partner_email
      FROM partner_events
      WHERE partner_email LIKE '%@%'
        AND length(partner_email) <= 512
        AND lower(partner_email) <> ${selfEmailLower}
    ),
    agg AS (
      SELECT
        partner_email,
        MIN(created_at) AS first_seen,
        MAX(created_at) AS last_seen,
        COUNT(*) FILTER (
          WHERE created_at >= ${rangeStart.toISOString()}::timestamptz
            AND created_at <= ${rangeEnd.toISOString()}::timestamptz
        )::int AS in_range_total,
        COUNT(*) FILTER (
          WHERE created_at >= ${rangeStart.toISOString()}::timestamptz
            AND created_at <= ${rangeEnd.toISOString()}::timestamptz
            AND folder <> 'sent'
        )::int AS recv_in_range,
        COUNT(*) FILTER (
          WHERE created_at >= ${rangeStart.toISOString()}::timestamptz
            AND created_at <= ${rangeEnd.toISOString()}::timestamptz
            AND folder = 'sent'
        )::int AS sent_in_range
      FROM clean
      GROUP BY partner_email
    )
    SELECT
      partner_email,
      first_seen,
      last_seen,
      in_range_total,
      recv_in_range,
      sent_in_range
    FROM agg
  `);

  const aggList: unknown[] = Array.isArray(aggRaw)
    ? aggRaw
    : ((aggRaw as { rows?: unknown[] }).rows ?? []);

  const parsed: NonNullable<ReturnType<typeof coerceRow>>[] = [];
  for (const raw of aggList) {
    const c = coerceRow(raw as Record<string, unknown>);
    if (c) parsed.push(c);
  }

  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();

  let newContactsCount = 0;
  let inactiveContactsCount = 0;
  for (const r of parsed) {
    const fs = r.first_seen.getTime();
    if (fs >= rangeStartMs && fs <= rangeEndMs) {
      newContactsCount += 1;
    }
    if (fs < rangeStartMs && r.in_range_total === 0) {
      inactiveContactsCount += 1;
    }
  }

  const inRangeContacts = parsed
    .filter((r) => r.in_range_total > 0)
    .sort((a, b) =>
      b.in_range_total !== a.in_range_total
        ? b.in_range_total - a.in_range_total
        : a.partner_email.localeCompare(b.partner_email)
    );

  const topContacts: Phase3ContactRow[] = inRangeContacts.slice(0, 15).map(
    (r) => ({
      email: r.partner_email,
      interactionCount: r.in_range_total,
      receivedInRange: r.recv_in_range,
      sentInRange: r.sent_in_range,
      relationshipScore: relationshipScore(r.recv_in_range, r.sent_in_range),
    })
  );

  const senderCandidates = inRangeContacts.map((r) => ({
    email: r.partner_email,
    count: r.recv_in_range,
  }));
  const recipientCandidates = inRangeContacts.map((r) => ({
    email: r.partner_email,
    count: r.sent_in_range,
  }));

  const mostActiveSender = pickMaxByCount(senderCandidates);
  const mostActiveRecipient = pickMaxByCount(recipientCandidates);

  const catRows = await db
    .select({
      folder: messages.folder,
      spamScore: messages.spamScore,
      subject: messages.subject,
      bodyPreview: sql<string>`substring(coalesce(${messages.bodyText}, ''), 1, 2000)`,
      fromAddr: messages.fromAddr,
      toAddr: messages.toAddr,
    })
    .from(messages)
    .where(
      and(
        eq(messages.userId, userId),
        gte(messages.createdAt, rangeStart),
        lte(messages.createdAt, rangeEnd),
        ne(messages.folder, "trash")
      )
    );

  const catCount: Record<EmailAnalyticsCategory, number> = {
    business: 0,
    personal: 0,
    finance: 0,
    spam: 0,
  };

  for (const row of catRows) {
    const counterpartyAddr =
      row.folder === "sent" ? row.toAddr : row.fromAddr;
    const bucket = classifyEmailForAnalytics({
      folder: row.folder,
      spamScore: Number(row.spamScore ?? 0),
      subject: row.subject ?? "",
      bodyPreview: row.bodyPreview ?? "",
      counterpartyAddr: counterpartyAddr ?? "",
    });
    catCount[bucket] += 1;
  }

  const total =
    catCount.business +
    catCount.personal +
    catCount.finance +
    catCount.spam;

  const maxCat = Math.max(
    catCount.business,
    catCount.personal,
    catCount.finance,
    catCount.spam
  );
  const prefOrder: EmailAnalyticsCategory[] = [
    "business",
    "personal",
    "finance",
    "spam",
  ];
  const topCategory =
    total === 0
      ? null
      : (prefOrder.find((k) => catCount[k] === maxCat) ?? null);
  const topN = topCategory ? catCount[topCategory] : 0;

  let topCategoryPercentage: number | null = null;
  if (total > 0 && topCategory !== null && topN > 0) {
    topCategoryPercentage = Math.round((1000 * topN) / total) / 10;
  }

  const label: Record<EmailAnalyticsCategory, string> = {
    business: "business-related",
    personal: "personal",
    finance: "finance-related",
    spam: "spam or bulk",
  };

  let insightLine = "No categorized email in this range yet.";
  if (total > 0 && topCategory !== null && topCategoryPercentage !== null) {
    insightLine = `${topCategoryPercentage}% of your email in this range looks ${label[topCategory]} by rule-based signals.`;
  }

  return {
    contactIntelligence: {
      topContacts,
      newContactsCount,
      inactiveContactsCount,
      mostActiveSender,
      mostActiveRecipient,
    },
    categories: {
      business: catCount.business,
      personal: catCount.personal,
      finance: catCount.finance,
      spam: catCount.spam,
      total,
      topCategory,
      topCategoryPercentage,
      insightLine,
    },
    phase3ComputedAt: nowIso,
  };
}

