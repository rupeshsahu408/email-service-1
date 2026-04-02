import { z } from "zod";
import type { EmailAnalyticsCategory } from "@/lib/email-analytics-category";
import { extractJsonObject, geminiGenerateContent } from "@/lib/gemini-json-client";

const catEnum = z.enum(["business", "personal", "finance", "spam"]);
const batchSchema = z.object({
  m: z.record(z.string().uuid(), catEnum),
});

export type CategoryRefineRow = {
  id: string;
  subject: string;
  counterpartyLine: string;
  folder: string;
  ruleCategory: EmailAnalyticsCategory;
};

/**
 * One Gemini call to re-label ambiguous rows. Returns id → category overrides only.
 * On any failure returns empty map (caller keeps rule-based counts).
 */
export async function batchRefineCategoriesWithAi(
  rows: CategoryRefineRow[]
): Promise<Map<string, EmailAnalyticsCategory>> {
  const out = new Map<string, EmailAnalyticsCategory>();
  if (rows.length === 0) return out;

  const lines = rows
    .map(
      (r) =>
        `${r.id}\t${r.folder}\t${r.ruleCategory}\t${r.subject.replace(/\s+/g, " ").slice(0, 160)}\t${r.counterpartyLine.replace(/\s+/g, " ").slice(0, 100)}`
    )
    .join("\n");

  const prompt = [
    "You refine email categories for analytics. Each line: id<TAB>folder<TAB>ruleCategory<TAB>subject<TAB>counterparty address.",
    "Allowed categories: business, personal, finance, spam.",
    "spam = unsolicited bulk, obvious junk, or phishing tone. finance = payments, invoices, banks. business = work, clients, meetings, B2B. personal = other human/social mail.",
    'Return STRICT JSON only: {"m":{"<message-uuid>":"business"|"personal"|"finance"|"spam",...}}',
    "Include every id listed. Use lowercase category names.",
    "",
    lines,
  ].join("\n");

  const gen = await geminiGenerateContent(prompt, 1200);
  if (!gen.ok) return out;

  const parsed = extractJsonObject(gen.text);
  const validated = parsed ? batchSchema.safeParse(parsed) : null;
  if (!validated?.success) return out;

  for (const r of rows) {
    const c = validated.data.m[r.id];
    if (c) out.set(r.id, c);
  }
  return out;
}
