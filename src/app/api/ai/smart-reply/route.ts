import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitAiWrite } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { logError } from "@/lib/logger";

const requestSchema = z.object({
  subject: z.string().max(998).optional().default(""),
  bodyText: z.string().max(500_000).optional().default(""),
  fromAddr: z.string().max(512).optional().default(""),
  tone: z.enum(["professional", "friendly"]).optional().default("professional"),
});

const modelOutputSchema = z.object({
  suggestions: z.array(z.string()).min(1).max(3),
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

function normalizeSuggestions(input: string[]): string[] {
  const out: string[] = [];
  for (const raw of input) {
    const cleaned = raw.replace(/\s+/g, " ").trim().slice(0, 220);
    if (!cleaned) continue;
    if (out.some((v) => v.toLowerCase() === cleaned.toLowerCase())) continue;
    out.push(cleaned);
    if (out.length >= 3) break;
  }
  return out;
}

function fallbackSuggestions(): string[] {
  return [
    "Thanks for the update. I will review this and get back to you shortly.",
    "Appreciate the note. This works for me, and I can proceed on my end.",
    "Thank you. Could you please share a quick clarification on the next step?",
  ];
}

function userFacingGeminiError(status: number, providerStatus?: string): string {
  if (status === 400) return "Smart reply request was rejected. Please try again.";
  if (status === 401 || status === 403) return "Smart reply is not authorized right now.";
  if (status === 404 || providerStatus === "NOT_FOUND")
    return "Smart reply model configuration is outdated.";
  if (status === 429 || providerStatus === "RESOURCE_EXHAUSTED")
    return "Smart reply is temporarily busy. Please try again soon.";
  if (status >= 500) return "Smart reply is temporarily unavailable. Please try again.";
  return "Smart reply generation failed. Please try again.";
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await rateLimitAiWrite(user.id);
  if (!rate.success) {
    return NextResponse.json(
      { error: "Smart reply rate limit reached. Try again later." },
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

  const { subject, bodyText, fromAddr, tone } = parsed.data;
  if (!subject.trim() && !bodyText.trim()) {
    return NextResponse.json(
      { error: "Message context is required." },
      { status: 400 }
    );
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) {
    return NextResponse.json(
      { error: "Smart reply is not configured on this server." },
      { status: 503 }
    );
  }

  const model = "gemini-2.5-flash-lite";
  const prompt = [
    "You are an assistant that writes short, natural email replies.",
    "Generate exactly 3 concise professional reply suggestions.",
    "No long paragraphs. Each suggestion should be 1 sentence, max 30 words.",
    "Return STRICT JSON only with shape:",
    '{ "suggestions": ["...", "...", "..."] }',
    "",
    `Tone: ${tone}.`,
    fromAddr ? `Sender hint: ${fromAddr}.` : "",
    `Original subject: ${subject || "(no subject)"}`,
    `Original body:\n${bodyText.slice(0, 4000)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(geminiKey)}`;

  const geminiRes = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 300,
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
      // ignore parse failure
    }

    logError("gemini_smart_reply_generate_failed", {
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
    return NextResponse.json({ suggestions: fallbackSuggestions() });
  }

  const extracted = extractJsonObject(rawText);
  const validated = extracted ? modelOutputSchema.safeParse(extracted) : null;
  if (!validated?.success) {
    return NextResponse.json({ suggestions: fallbackSuggestions() });
  }

  const suggestions = normalizeSuggestions(validated.data.suggestions);
  if (suggestions.length === 0) {
    return NextResponse.json({ suggestions: fallbackSuggestions() });
  }

  return NextResponse.json({ suggestions });
}

