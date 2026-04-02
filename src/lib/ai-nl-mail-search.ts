import { z } from "zod";
import { extractJsonObject, geminiGenerateContent } from "@/lib/gemini-json-client";

const folderEnum = z.enum(["inbox", "sent", "spam", "archive", "trash"]);

const parsedSchema = z.object({
  q: z.string().max(180).optional().default(""),
  folder: folderEnum.optional(),
  sinceIso: z.string().max(40).optional(),
  untilIso: z.string().max(40).optional(),
});

export type NaturalMailSearchPlan = z.infer<typeof parsedSchema>;

function sanitizeFallbackQ(q: string): string {
  return q.trim().slice(0, 180).replace(/[^\p{L}\p{N}\s.@+-]/gu, " ");
}

/**
 * One Gemini call to turn a natural phrase into list filters. On failure
 * returns a safe keyword-only plan (no AI fields).
 */
export async function planNaturalMailSearch(
  userQuery: string,
  now: Date = new Date()
): Promise<NaturalMailSearchPlan> {
  const trimmed = userQuery.trim().slice(0, 500);
  if (!trimmed) {
    return { q: "" };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { q: sanitizeFallbackQ(trimmed) };
  }

  const utc = now.toISOString();
  const prompt = [
    "Convert the user's mailbox search into filters for a SQL-backed mail client.",
    `Reference now (UTC): ${utc}`,
    "Return STRICT JSON only with keys: q (optional string, keywords for subject/body/sender, NOT full sentences), folder (optional: inbox|sent|spam|archive|trash), sinceIso (optional RFC3339 UTC start), untilIso (optional RFC3339 UTC end).",
    "Interpret: 'last week' = 7-day window ending at now; 'this week' = since UTC Monday 00:00 of current week through now; 'yesterday' = previous UTC day.",
    "If the user names a person, put their name or email fragment in q. Omit folder unless clearly about spam/sent/archive/trash.",
    "Keep q short. Use empty string \"\" only when the query is purely temporal.",
    "",
    `User query: ${trimmed}`,
  ].join("\n");

  const gen = await geminiGenerateContent(prompt, 512);
  if (!gen.ok) {
    return { q: sanitizeFallbackQ(trimmed) };
  }

  const parsed = extractJsonObject(gen.text);
  const valid = parsed ? parsedSchema.safeParse(parsed) : null;
  if (!valid?.success) {
    return { q: sanitizeFallbackQ(trimmed) };
  }

  const q = sanitizeFallbackQ(valid.data.q ?? "");
  const out: NaturalMailSearchPlan = { q };
  if (valid.data.folder) out.folder = valid.data.folder;

  const checkIso = (s: string | undefined): string | undefined => {
    if (!s) return undefined;
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return undefined;
    return d.toISOString();
  };
  const sinceIso = checkIso(valid.data.sinceIso);
  const untilIso = checkIso(valid.data.untilIso);
  if (sinceIso) out.sinceIso = sinceIso;
  if (untilIso) out.untilIso = untilIso;

  return out;
}
