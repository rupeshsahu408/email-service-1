import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { parsePrimaryEmail } from "@/lib/mail-filter";

export const SPAM_SCORE_THRESHOLD = 5;

/** Phrases scored at +2 each when any appear in subject + body (capped). */
const SPAM_KEYWORD_PHRASES = [
  "free",
  "win money",
  "lottery",
  "urgent",
  "click here",
  "limited offer",
] as const;

const SUSPICIOUS_ATTACHMENT_EXT = /\.(exe|apk|zip)(\s|$|[?#])/i;
/** Also match bare extension at end of filename */
const SUSPICIOUS_ATTACHMENT_SUFFIX = /\.(exe|apk|zip)$/i;

export type SpamScoreBreakdown = {
  score: number;
  reasons: string[];
};

function haystack(subject: string, bodyText: string, bodyHtml: string | null | undefined): string {
  return `${subject}\n${bodyText}\n${bodyHtml ?? ""}`.toLowerCase();
}

export function scoreSpamKeywords(subject: string, bodyText: string, bodyHtml?: string | null): SpamScoreBreakdown {
  const h = haystack(subject, bodyText, bodyHtml);
  const reasons: string[] = [];
  let score = 0;
  for (const phrase of SPAM_KEYWORD_PHRASES) {
    if (h.includes(phrase)) {
      score += 2;
      reasons.push(`keyword:${phrase}`);
    }
  }
  return { score, reasons };
}

export function scoreSuspiciousAttachments(filenames: string[]): SpamScoreBreakdown {
  const reasons: string[] = [];
  let score = 0;
  for (const raw of filenames) {
    const name = raw.toLowerCase();
    if (SUSPICIOUS_ATTACHMENT_SUFFIX.test(name) || SUSPICIOUS_ATTACHMENT_EXT.test(name)) {
      score += 3;
      reasons.push(`attachment:${raw.slice(0, 80)}`);
      break;
    }
  }
  return { score, reasons };
}

export function scoreLinkDensity(bodyText: string, bodyHtml?: string | null): SpamScoreBreakdown {
  const combined = `${bodyText}\n${bodyHtml ?? ""}`;
  const matches = combined.match(/https?:\/\//gi);
  const n = matches?.length ?? 0;
  if (n > 5) {
    return { score: 1, reasons: [`links:${n}`] };
  }
  return { score: 0, reasons: [] };
}

export function scoreSubjectFormatting(subject: string): SpamScoreBreakdown {
  const reasons: string[] = [];
  let score = 0;
  const letters = subject.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 5) {
    const upper = letters.replace(/[^A-Z]/g, "").length;
    if (upper / letters.length > 0.7) {
      score += 1;
      reasons.push("subject:mostly_caps");
    }
  }
  if (/!!!|\$\$\$/.test(subject)) {
    score += 1;
    reasons.push("subject:symbols");
  }
  return { score, reasons };
}

export function scoreSuspiciousDomain(fromAddr: string): SpamScoreBreakdown {
  const email = parsePrimaryEmail(fromAddr);
  const at = email.lastIndexOf("@");
  if (at <= 0) return { score: 0, reasons: [] };
  const domain = email.slice(at + 1);
  if (!domain) return { score: 0, reasons: [] };

  if (domain.length > 28) {
    return { score: 2, reasons: ["domain:long"] };
  }
  if (/\d{4,}/.test(domain)) {
    return { score: 2, reasons: ["domain:digits"] };
  }
  if (/^[a-z0-9]{14,}\.(xyz|fun|icu|click|top|work|surf)$/i.test(domain)) {
    return { score: 2, reasons: ["domain:suspicious_tld"] };
  }
  const parts = domain.split(".");
  if (parts.some((p) => p.length > 22)) {
    return { score: 2, reasons: ["domain:long_label"] };
  }
  return { score: 0, reasons: [] };
}

function senderMatchesExpr(normEmail: string) {
  const n = normEmail.toLowerCase();
  const bracketed = `<${n}>`;
  return sql`(position(${bracketed} in lower(coalesce(${messages.fromAddr}, ''))) > 0 OR lower(trim(both from coalesce(${messages.fromAddr}, ''))) = ${n})`;
}

/** +2 if this user has never received mail from this sender (inbox/spam/archive/sent) before this ingest. */
export async function scoreUnknownSender(
  userId: string,
  fromAddr: string
): Promise<SpamScoreBreakdown> {
  const norm = parsePrimaryEmail(fromAddr);
  if (!norm.includes("@")) return { score: 0, reasons: [] };

  const rows = await getDb()
    .select({ c: count() })
    .from(messages)
    .where(
      and(
        eq(messages.userId, userId),
        senderMatchesExpr(norm),
        inArray(messages.folder, ["inbox", "spam", "archive", "sent"])
      )
    );
  const prior = Number(rows[0]?.c ?? 0);
  if (prior === 0) {
    return { score: 2, reasons: ["sender:unknown"] };
  }
  return { score: 0, reasons: [] };
}

/**
 * +3 if 5+ messages from sender in the last minute, and/or +3 if 20+ in the last hour.
 */
export async function scoreSenderVelocity(
  userId: string,
  fromAddr: string,
  now: Date = new Date()
): Promise<SpamScoreBreakdown> {
  const norm = parsePrimaryEmail(fromAddr);
  if (!norm.includes("@")) return { score: 0, reasons: [] };

  const oneMinuteAgo = new Date(now.getTime() - 60_000);
  const oneHourAgo = new Date(now.getTime() - 3600_000);

  const [minRows, hourRows] = await Promise.all([
    getDb()
      .select({ c: count() })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          senderMatchesExpr(norm),
          gte(messages.createdAt, oneMinuteAgo)
        )
      ),
    getDb()
      .select({ c: count() })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          senderMatchesExpr(norm),
          gte(messages.createdAt, oneHourAgo)
        )
      ),
  ]);

  const minN = Number(minRows[0]?.c ?? 0);
  const hourN = Number(hourRows[0]?.c ?? 0);
  let score = 0;
  const reasons: string[] = [];
  if (minN >= 5) {
    score += 3;
    reasons.push(`velocity:1m:${minN}`);
  }
  if (hourN >= 20) {
    score += 3;
    reasons.push(`velocity:1h:${hourN}`);
  }
  return { score, reasons };
}

export function mergeBreakdowns(parts: SpamScoreBreakdown[]): SpamScoreBreakdown {
  let score = 0;
  const reasons: string[] = [];
  for (const p of parts) {
    score += p.score;
    reasons.push(...p.reasons);
  }
  return { score, reasons };
}

export async function computeInboundSpamScore(params: {
  userId: string;
  fromAddr: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  attachmentFilenames: string[];
  /** When false, skip DB-heavy rules (unknown sender + velocity). */
  includeHistoryRules: boolean;
  now?: Date;
}): Promise<SpamScoreBreakdown> {
  const staticParts = [
    scoreSpamKeywords(params.subject, params.bodyText, params.bodyHtml),
    scoreSuspiciousDomain(params.fromAddr),
    scoreLinkDensity(params.bodyText, params.bodyHtml),
    scoreSuspiciousAttachments(params.attachmentFilenames),
    scoreSubjectFormatting(params.subject),
  ];

  if (!params.includeHistoryRules) {
    return mergeBreakdowns(staticParts);
  }

  const now = params.now ?? new Date();
  const [unknown, velocity] = await Promise.all([
    scoreUnknownSender(params.userId, params.fromAddr),
    scoreSenderVelocity(params.userId, params.fromAddr, now),
  ]);

  return mergeBreakdowns([...staticParts, unknown, velocity]);
}
