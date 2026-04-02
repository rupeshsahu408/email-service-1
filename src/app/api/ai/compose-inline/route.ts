import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitAiInline } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { logError } from "@/lib/logger";

const requestSchema = z.object({
  subject: z.string().max(998).optional().default(""),
  textBeforeCursor: z.string().max(4000),
  textAfterCursor: z.string().max(1000).optional().default(""),
});

const modelOutputSchema = z.object({
  suggestion: z.string().max(180),
});

function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // continue
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]) as unknown;
    } catch {
      // continue
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(slice) as unknown;
    } catch {
      // continue
    }
  }

  return null;
}

function getGeminiText(modelResponse: unknown): string {
  type GeminiResponse = {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: unknown;
        }>;
      };
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

function normalizeSuggestion(raw: string, beforeTrimmed: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  if (!s) return "";

  // Avoid over-aggressive repetition removal:
  // Only strip the tail if it is clearly longer context than the suggestion
  // and stripping would still leave something meaningful.
  const tail = beforeTrimmed.replace(/\s+/g, " ").trimEnd().slice(-100);
  if (tail && s.length > tail.length + 3) {
    const lower = s.toLowerCase();
    const t = tail.toLowerCase();
    if (lower.startsWith(t)) {
      const stripped = s.slice(tail.length).trimStart();
      if (stripped.trim().length > 0) {
        s = stripped;
      }
    }
  }
  if (s.length > 160) s = s.slice(0, 157).trimEnd() + "…";
  return s;
}

function userFacingGeminiError(status: number, providerStatus?: string): string {
  if (status === 400) {
    return "Suggestion request was rejected. Please try again.";
  }
  if (status === 401 || status === 403) {
    return "AI service is not authorized. Please contact support.";
  }
  if (status === 404 || providerStatus === "NOT_FOUND") {
    return "AI model configuration is outdated. Please contact support.";
  }
  if (status === 429 || providerStatus === "RESOURCE_EXHAUSTED") {
    return "AI service is temporarily busy. Please try again soon.";
  }
  if (status >= 500) {
    return "AI service is temporarily unavailable. Please try again.";
  }
  return "Suggestion generation failed. Please try again.";
}

export async function POST(request: NextRequest) {
  const debugLog = process.env.NODE_ENV === "development";
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await rateLimitAiInline(user.id);
  if (!rate.success) {
    return NextResponse.json(
      { error: "Inline suggestion limit reached. Try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { subject, textBeforeCursor, textAfterCursor } = parsed.data;
  const beforeTrim = textBeforeCursor.trim();
  if (beforeTrim.length < 12) {
    return NextResponse.json(
      { error: "More context is needed before suggesting a continuation." },
      { status: 400 }
    );
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) {
    return NextResponse.json(
      { error: "AI suggestions are not configured on this server." },
      { status: 503 }
    );
  }

  const model = "gemini-2.5-flash-lite";
  const beforeSnippet = textBeforeCursor.slice(-2000);
  const afterSnippet = textAfterCursor.slice(0, 800);

  const prompt = [
    "You complete professional email bodies like Smart Compose.",
    "The user is typing; suggest ONLY the next few words or a short clause (max ~15 words, one short sentence at most).",
    "Do not repeat text they already wrote. No markdown, no quotes around the suggestion.",
    "Return STRICT JSON only: { \"suggestion\": \"...\" }",
    "",
    `Subject line (context): ${subject.trim() || "(no subject)"}`,
    "",
    "Text before cursor:",
    beforeSnippet,
    "",
    "Text after cursor:",
    afterSnippet || "(end)",
  ].join("\n");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(geminiKey)}`;

  const geminiRes = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.65,
        maxOutputTokens: 96,
      },
    }),
  });

  if (!geminiRes.ok) {
    const raw = await geminiRes.text().catch(() => "");
    let providerCode = 0;
    let providerStatus = "";
    let providerMessage = "";
    try {
      const parsedErr = JSON.parse(raw) as {
        error?: { code?: number; status?: string; message?: string };
      };
      providerCode = Number(parsedErr.error?.code ?? 0);
      providerStatus = String(parsedErr.error?.status ?? "");
      providerMessage = String(parsedErr.error?.message ?? "");
    } catch {
      // ignore
    }

    logError("gemini_compose_inline_failed", {
      userId: user.id,
      status: geminiRes.status,
      model,
      providerCode,
      providerStatus,
      providerMessage: providerMessage.slice(0, 500),
      bodyPreview: raw.slice(0, 1000),
    });

    return NextResponse.json(
      { error: userFacingGeminiError(geminiRes.status, providerStatus) },
      { status: 502 }
    );
  }

  const geminiJson = (await geminiRes.json().catch(() => ({}))) as unknown;
  const rawText = getGeminiText(geminiJson);
  if (!rawText.trim()) {
    return NextResponse.json({ suggestion: "" });
  }

  const extracted = extractJsonObject(rawText);
  // Some models occasionally return slightly non-JSON text; attempt a
  // best-effort extraction before we give up.
  let validated:
    | { success: true; data: { suggestion: string } }
    | { success: false };

  const directParsed = extracted ? modelOutputSchema.safeParse(extracted) : null;
  if (directParsed?.success) {
    validated = directParsed;
  } else {
    // Regex fallback: handles the common case { "suggestion": "..." }.
    const match = rawText.match(/"suggestion"\s*:\s*"([^"]*)"/i);
    const maybe = match?.[1] ? { suggestion: match[1] } : null;
    validated = maybe ? modelOutputSchema.safeParse(maybe) : { success: false };
  }

  if (!validated?.success) {
    if (debugLog) {
      logError("gemini_compose_inline_parse_failed", {
        status: geminiRes.status,
        rawTextPreview: rawText.slice(0, 300),
      });
    }
    return NextResponse.json({ suggestion: "" });
  }

  const suggestion = normalizeSuggestion(validated.data.suggestion, beforeTrim);
  if (!suggestion && debugLog) {
    logError("gemini_compose_inline_empty_after_normalize", {
      beforeTrimTailPreview: beforeTrim.slice(-120),
      suggestionRawPreview: validated.data.suggestion.slice(0, 120),
    });
  }
  return NextResponse.json({ suggestion });
}
