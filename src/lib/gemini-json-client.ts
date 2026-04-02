/**
 * Minimal Gemini generateContent helper for JSON-shaped AI features.
 * API key stays server-side only.
 */

const DEFAULT_MODEL = "gemini-2.5-flash-lite";

export function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    /* continue */
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]) as unknown;
    } catch {
      /* continue */
    }
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as unknown;
    } catch {
      return null;
    }
  }
  return null;
}

export function getGeminiText(modelResponse: unknown): string {
  type GeminiResponse = {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: unknown }> };
    }>;
  };
  const typed = modelResponse as GeminiResponse;
  const parts = typed?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const texts = parts
      .map((p) => (p && typeof p.text === "string" ? p.text : null))
      .filter(Boolean);
    if (texts.length > 0) return texts.join("");
  }
  return "";
}

export async function geminiGenerateContent(
  prompt: string,
  maxOutputTokens = 1024
): Promise<{ ok: true; text: string } | { ok: false; status: number; text: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, status: 503, text: "" };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    DEFAULT_MODEL
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens,
      },
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    return { ok: false, status: res.status, text: raw.slice(0, 500) };
  }

  const json = (await res.json().catch(() => ({}))) as unknown;
  const text = getGeminiText(json);
  return { ok: true, text };
}

export function getDefaultGeminiModel(): string {
  return DEFAULT_MODEL;
}
