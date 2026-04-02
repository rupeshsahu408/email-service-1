import type { MessageFolder } from "@/db/schema";
import { parsePrimaryEmail } from "@/lib/mail-filter";

/**
 * Rule-based email categories for analytics.
 * Replace/extend with AI classification later via the same entry point.
 */
export type EmailAnalyticsCategory =
  | "business"
  | "personal"
  | "finance"
  | "spam";

const FINANCE_KEYWORDS = [
  "invoice",
  "payment",
  "receipt",
  "paid receipt",
  "bill is",
  "your bill",
  "transaction",
  "bank transfer",
  "wire transfer",
  "paypal",
  "stripe",
  "subscription renew",
  "tax invoice",
  "tax return",
  "refund",
  "remittance",
  "direct debit",
  "ach transfer",
  "statement available",
  "payment due",
  "amount due",
  "balance due",
];

const BUSINESS_KEYWORDS = [
  "meeting",
  "zoom meeting",
  "calendar",
  "project",
  "client",
  "proposal",
  "contract",
  "deadline",
  "quarterly",
  "partnership",
  "onboarding",
  "rfp",
  "vendor",
  "procurement",
  "conference",
  "agenda",
  "sprint",
  "roadmap",
  "stakeholder",
  "business review",
  "quarterly report",
];

const PERSONAL_KEYWORDS = [
  "happy birthday",
  "catch up",
  "weekend",
  "dinner",
  "vacation",
  "family",
  "thanks!",
  "thank you so much",
  "love,",
  "miss you",
];

const SPAM_PHRASES = [
  "you won",
  "congratulations you",
  "viagra",
  "cialis",
  "lottery winner",
  "claim your prize",
  "urgent: your account will be closed",
  "crypto airdrop",
  "100% free money",
  "no strings attached prize",
];

const BUSINESS_DOMAIN_HINTS = [
  "linkedin.com",
  "slack.com",
  "zoom.us",
  "salesforce.com",
  "hubspot.com",
  "notion.so",
];

const CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
]);

function extractDomainFromAddr(addr: string): string | null {
  const e = parsePrimaryEmail(addr);
  const at = e.lastIndexOf("@");
  if (at < 1 || at === e.length - 1) return null;
  return e.slice(at + 1).toLowerCase();
}

function textIncludesAny(haystack: string, needles: string[]): boolean {
  for (const n of needles) {
    if (haystack.includes(n)) return true;
  }
  return false;
}

export type ClassifyEmailForAnalyticsInput = {
  folder: MessageFolder;
  spamScore: number;
  subject: string;
  /** First ~2k chars of body — caller truncates for DB efficiency */
  bodyPreview: string;
  /** Incoming: from; sent: primary recipient */
  counterpartyAddr: string;
};

/**
 * Deterministic rule-based category. When uncertain, defaults to personal
 * (casual / non-commercial) rather than business, except spam signals.
 */
export function classifyEmailForAnalytics(
  input: ClassifyEmailForAnalyticsInput
): EmailAnalyticsCategory {
  if (input.folder === "spam" || input.spamScore >= 5) {
    return "spam";
  }

  const subj = (input.subject ?? "").toLowerCase();
  const body = (input.bodyPreview ?? "").toLowerCase();
  const blob = `${subj}\n${body}`;

  if (textIncludesAny(blob, SPAM_PHRASES)) {
    return "spam";
  }

  if (textIncludesAny(blob, FINANCE_KEYWORDS)) {
    return "finance";
  }

  if (textIncludesAny(blob, BUSINESS_KEYWORDS)) {
    return "business";
  }

  const dom = extractDomainFromAddr(input.counterpartyAddr);
  if (dom) {
    for (const h of BUSINESS_DOMAIN_HINTS) {
      if (dom === h || dom.endsWith(`.${h}`)) {
        return "business";
      }
    }
  }

  if (textIncludesAny(blob, PERSONAL_KEYWORDS)) {
    return "personal";
  }

  if (dom && CONSUMER_DOMAINS.has(dom)) {
    return "personal";
  }

  return "personal";
}

/**
 * Hybrid AI path: “default personal” rows with no personal keywords / consumer
 * mailbox / business-domain hints — good candidates for Gemini refinement.
 */
export function shouldRefineCategoryWithAi(
  input: ClassifyEmailForAnalyticsInput,
  ruleCategory: EmailAnalyticsCategory
): boolean {
  if (ruleCategory === "spam") return false;
  if (input.folder === "spam" || input.spamScore >= 5) return false;
  const subj = (input.subject ?? "").toLowerCase();
  const body = (input.bodyPreview ?? "").toLowerCase();
  const blob = `${subj}\n${body}`;

  if (textIncludesAny(blob, SPAM_PHRASES)) return false;
  if (ruleCategory === "finance" || ruleCategory === "business") return false;
  if (textIncludesAny(blob, PERSONAL_KEYWORDS)) return false;

  const dom = extractDomainFromAddr(input.counterpartyAddr);
  if (dom && CONSUMER_DOMAINS.has(dom)) return false;
  if (dom) {
    for (const h of BUSINESS_DOMAIN_HINTS) {
      if (dom === h || dom.endsWith(`.${h}`)) return false;
    }
  }

  const len = (input.subject?.length ?? 0) + (input.bodyPreview?.length ?? 0);
  if (len < 12) return false;

  return ruleCategory === "personal";
}
