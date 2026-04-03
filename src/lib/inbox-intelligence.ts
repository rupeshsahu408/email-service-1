import { z } from "zod";
import { extractJsonObject, geminiGenerateContent } from "@/lib/gemini-json-client";
import { parsePrimaryEmail } from "@/lib/mail-filter";

export type MailPriority = "high" | "medium" | "low";

export type InboxIntelligenceRow = {
  id: string;
  priority: MailPriority;
  /** Short rule-based explanation */
  priorityNote: string;
  /** Action hints (rules + optional AI) */
  tips: string[];
  usedAiTip: boolean;
};

const HIGH_TERMS =
  /\b(urgent|asap|immediately|critical|legal|lawsuit|outage|incident|ceo|board|invoice due|payment due|overdue)\b/i;
const FINANCE_TERMS =
  /\b(invoice|payment|refund|bank|wire|ach|paypal|stripe|subscription renew)\b/i;

type MsgShape = {
  id: string;
  folder: string;
  subject: string;
  snippet: string | null;
  fromAddr: string;
  readAt: Date | null;
  createdAt: Date;
};

type InboxRuleRow = Omit<InboxIntelligenceRow, "usedAiTip">;

function blob(m: MsgShape): string {
  return `${m.subject}\n${m.snippet ?? ""}`;
}

/**
 * Hybrid signals: important senders + keywords + read state + age.
 */
export function computeInboxIntelligenceRules(
  rows: MsgShape[],
  importantSenders: Set<string>,
  selfEmailLower: string
): Map<string, InboxRuleRow> {
  const out = new Map<string, InboxRuleRow>();
  const now = Date.now();

  for (const m of rows) {
    const from = parsePrimaryEmail(m.fromAddr);
    const isIncoming =
      m.folder !== "sent" && from && from !== selfEmailLower;
    const unread = m.readAt === null;
    const ageMs = now - m.createdAt.getTime();
    const ageDays = ageMs / 86400000;

    const fromImportant = from ? importantSenders.has(from) : false;
    const text = blob(m);
    const urgent = HIGH_TERMS.test(text);
    const finance = FINANCE_TERMS.test(text);

    let priority: MailPriority = "low";
    const notes: string[] = [];
    const tips: string[] = [];

    if (m.folder === "spam") {
      priority = "low";
      notes.push("Spam folder");
    } else if (m.folder === "sent") {
      priority = "low";
      notes.push("Sent");
    } else if (isIncoming) {
      if ((unread && fromImportant && (urgent || finance)) || (unread && urgent)) {
        priority = "high";
        if (fromImportant) notes.push("Frequent contact");
        if (urgent) notes.push("Urgent tone");
        if (finance) notes.push("Money-related");
      } else if (unread && (fromImportant || finance || urgent)) {
        priority = "medium";
        if (fromImportant) notes.push("Known contact");
        if (finance) notes.push("Money-related");
        if (urgent) notes.push("Strong wording");
      } else if (unread) {
        priority = "medium";
        notes.push("Unread");
      } else {
        priority = "low";
        notes.push("Read");
      }

      if (unread && isIncoming) {
        if (ageDays >= 3) {
          tips.push("Follow up — waiting several days without a reply.");
        } else if (ageDays >= 1 && (fromImportant || finance)) {
          tips.push("Consider replying — looks time-sensitive.");
        } else if (fromImportant && unread) {
          tips.push("Important sender — worth opening soon.");
        }
      }
    }

    if (tips.length === 0 && unread && isIncoming && m.folder === "inbox") {
      tips.push("You should reply to this email when you can.");
    }

    const priorityNote =
      notes.filter(Boolean).join(" · ") ||
      (priority === "high" ? "High — keywords or sender" : "Heuristic priority");

    out.set(m.id, {
      id: m.id,
      priority,
      priorityNote,
      tips: tips.slice(0, 2),
    });
  }

  return out;
}

const tipsSchema = z.object({
  m: z.record(z.string().uuid(), z.string().max(140)),
});

/**
 * Adds at most one extra short tip per row; skipped when Gemini fails.
 */
export async function batchAiInboxTips(
  rows: Array<{
    id: string;
    subject: string;
    fromLine: string;
    ruleSummary: string;
  }>
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (rows.length === 0) return out;

  const lines = rows
    .map(
      (r) =>
        `${r.id}\t${r.subject.replace(/\s+/g, " ").slice(0, 120)}\t${r.fromLine.replace(/\s+/g, " ").slice(0, 80)}\t${r.ruleSummary.slice(0, 120)}`
    )
    .join("\n");

  const prompt = [
    "You help triage email. Each line: id, subject, from, brief rule hint.",
    'Add ONE short actionable inbox tip per id (max 18 words). Examples: "Schedule a reply to this client", "This payment thread may need confirmation".',
    'Return STRICT JSON only: {"m":{"<uuid>":"tip text",...}}',
    "Tone: practical, not alarmist. Skip duplicate ideas already in rule hint.",
    "",
    lines,
  ].join("\n");

  const gen = await geminiGenerateContent(prompt, 1200);
  if (!gen.ok) return out;

  const parsed = extractJsonObject(gen.text);
  const v = parsed ? tipsSchema.safeParse(parsed) : null;
  if (!v?.success) return out;

  for (const r of rows) {
    const t = v.data.m[r.id];
    if (t && t.trim()) out.set(r.id, t.trim());
  }
  return out;
}
