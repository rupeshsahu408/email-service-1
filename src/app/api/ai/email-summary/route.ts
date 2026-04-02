import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitAiWrite } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { logError } from "@/lib/logger";

const requestSchema = z.object({
  subject: z.string().max(998).optional().default(""),
  bodyText: z.string().max(500_000).optional().default(""),
});

const modelOutputSchema = z.object({
  bullets: z.array(z.string()).min(2).max(4),
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

function normalizeBullets(input: string[]): string[] {
  const out: string[] = [];
  for (const raw of input) {
    const cleaned = raw.replace(/\s+/g, " ").trim().slice(0, 240);
    if (!cleaned) continue;
    if (out.some((v) => v.toLowerCase() === cleaned.toLowerCase())) continue;
    out.push(cleaned);
    if (out.length >= 4) break;
  }
  return out;
}

function fallbackBullets(subject: string, bodyText: string): string[] {
  const trimmedBody = bodyText.replace(/\s+/g, " ").trim();
  const firstSentence = trimmedBody.split(/[.!?]\s+/)[0]?.trim() ?? "";
  const fallbackA = subject.trim()
    ? `Topic: ${subject.trim().slice(0, 180)}`
    : "Main topic identified from the email content.";
  const fallbackB = firstSentence
    ? `Key point: ${firstSentence.slice(0, 180)}`
    : "Key point: Please review the original message for full details.";
  return [fallbackA, fallbackB];
}

function userFacingGeminiError(status: number, providerStatus?: string): string {
  if (status === 400) return "Summary request was rejected. Please try again.";
  if (status === 401 || status === 403) return "Summary is not authorized right now.";
  if (status === 404 || providerStatus === "NOT_FOUND")
    return "Summary model configuration is outdated.";
  if (status === 429 || providerStatus === "RESOURCE_EXHAUSTED")
    return "Summary is temporarily busy. Please try again soon.";
  if (status >= 500) return "Summary service is temporarily unavailable. Please try again.";
  return "Could not generate summary. Please try again.";
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await rateLimitAiWrite(user.id);
  if (!rate.success) {
    return NextResponse.json(
      { error: "Summary rate limit reached. Try again later." },
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

  const { subject, bodyText } = parsed.data;
  if (!subject.trim() && !bodyText.trim()) {
    return NextResponse.json(
      { error: "Message content is required." },
      { status: 400 }
    );
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) {
    return NextResponse.json(
      { error: "Summary is not configured on this server." },
      { status: 503 }
    );
  }

  const model = "gemini-2.5-flash-lite";
  const prompt = [
    "You summarize emails into short key points.",
    "Return exactly 2 to 4 concise bullet points.",
    "No long paragraphs. No extra commentary.",
    'Return STRICT JSON only with shape: { "bullets": ["...", "..."] }',
    "",
    `Subject: ${subject || "(no subject)"}`,
    `Body:\n${bodyText.slice(0, 8000)}`,
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
        temperature: 0.2,
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
      // ignore parse error
    }

    logError("gemini_email_summary_generate_failed", {
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
    return NextResponse.json({ bullets: fallbackBullets(subject, bodyText) });
  }

  const extracted = extractJsonObject(rawText);
  const validated = extracted ? modelOutputSchema.safeParse(extracted) : null;
  if (!validated?.success) {
    return NextResponse.json({ bullets: fallbackBullets(subject, bodyText) });
  }

  const bullets = normalizeBullets(validated.data.bullets);
  if (bullets.length < 2) {
    return NextResponse.json({ bullets: fallbackBullets(subject, bodyText) });
  }

  return NextResponse.json({ bullets });
}

