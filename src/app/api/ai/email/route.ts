import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitAiWrite } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { logError, logInfo } from "@/lib/logger";

const aiRequestSchema = z.object({
  instruction: z.string().min(3).max(2000),
  tone: z.enum(["formal", "casual"]).optional(),
  length: z.enum(["short", "detailed"]).optional(),
  toHint: z.string().optional().default(""),
  existingSubject: z.string().optional().default(""),
});

const aiResponseSchema = z.object({
  subject: z.string().trim().max(998),
  bodyText: z.string().max(500_000).optional().default(""),
  bodyHtml: z.string().max(500_000).optional(),
});

function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1) Direct JSON parse.
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // continue
  }

  // 2) Extract from ```json fenced blocks.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]) as unknown;
    } catch {
      // continue
    }
  }

  // 3) Last-ditch: find outer braces and parse that substring.
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
  // Gemini generateContent (v1beta) typically returns:
  // { candidates: [{ content: { parts: [{ text: "..." }] } }] }
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

function sanitizeBodyHtml(html: string): string {
  // Light-weight sanitization to reduce obvious script injection.
  let s = html;

  // Remove <script> and <style> blocks.
  s = s.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");

  // Remove inline event handlers like onload= / onclick=
  s = s.replace(/\son\w+\s*=\s*(["']).*?\1/gi, "");

  // Neutralize javascript: URLs in href/src.
  s = s.replace(
    /\b(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi,
    (_m, attr: string, quote: string) => `${attr}=${quote}#${quote}`
  );

  return s.trim();
}

function plainTextToEmailHtml(bodyText: string): string {
  const safe = bodyText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  return `<div>${safe.replace(/\n/g, "<br/>")}</div>`;
}

function userFacingGeminiError(status: number, providerStatus?: string): string {
  if (status === 400) {
    return "AI request was rejected. Please try a shorter or clearer instruction.";
  }
  if (status === 401 || status === 403) {
    return "AI service is not authorized. Please contact support.";
  }
  if (status === 404 || providerStatus === "NOT_FOUND") {
    return "AI model configuration is outdated. Please contact support.";
  }
  if (status === 429 || providerStatus === "RESOURCE_EXHAUSTED") {
    return "AI service is temporarily busy or out of quota. Please try again soon.";
  }
  if (status >= 500) {
    return "AI service is temporarily unavailable. Please try again.";
  }
  return "AI generation failed. Please try again.";
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await rateLimitAiWrite(user.id);
  if (!rate.success) {
    return NextResponse.json(
      { error: "AI email generation rate limit reached. Try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = aiRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) {
    return NextResponse.json(
      { error: "AI generation is not configured on this server." },
      { status: 503 }
    );
  }

  const { instruction, tone, length, toHint, existingSubject } = parsed.data;

  // Keep this model in sync with currently available v1beta generateContent models.
  const model = "gemini-2.5-flash-lite";

  const toneLine = tone ? `Tone: ${tone}.` : "";
  const lengthLine = length ? `Length: ${length}.` : "";
  const toLine = toHint ? `Recipient hint: ${toHint}.` : "";
  const subjectLine = existingSubject ? `Existing subject (may be updated): ${existingSubject}.` : "";

  const prompt = [
    "You are an expert email writer.",
    "Write a professional email according to the user instruction.",
    toneLine,
    lengthLine,
    toLine,
    subjectLine,
    "",
    `User instruction: ${instruction}`,
    "",
    "Return STRICT JSON only (no markdown fences, no commentary) with this exact shape:",
    '{ "subject": string, "bodyText": string, "bodyHtml": string }',
    "",
    "Constraints:",
    "- subject: <= 998 characters",
    "- bodyText: plain text email body (use \\n for line breaks)",
    "- bodyHtml: minimal HTML for an email body (use <div>, <br/>, <p>, <strong>, <em>, <ul><li>, <a> only).",
    "- Do not include the recipient/sender addresses; just the message.",
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
        temperature: 0.4,
        maxOutputTokens: 1024,
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
      // Leave parsed provider fields empty when body is non-JSON.
    }

    logError("gemini_ai_email_generate_failed", {
      userId: user.id,
      status: geminiRes.status,
      model,
      providerCode,
      providerStatus,
      providerMessage: providerMessage.slice(0, 500),
      bodyPreview: raw.slice(0, 1000),
    });

    const message = userFacingGeminiError(geminiRes.status, providerStatus);
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }

  const geminiJson = (await geminiRes.json().catch(() => ({}))) as unknown;
  const rawText = getGeminiText(geminiJson);

  if (!rawText.trim()) {
    return NextResponse.json(
      { error: "AI generation returned empty output." },
      { status: 502 }
    );
  }

  const extracted = extractJsonObject(rawText);
  const responseParsed = extracted
    ? aiResponseSchema.safeParse(extracted)
    : aiResponseSchema.safeParse(null);

  if (responseParsed.success) {
    const subject = responseParsed.data.subject;
    const bodyText = responseParsed.data.bodyText ?? "";

    // Prefer sanitized HTML. If absent, create a safe HTML version from bodyText.
    const maybeHtml = responseParsed.data.bodyHtml?.trim() ?? "";
    const safeHtml = maybeHtml ? sanitizeBodyHtml(maybeHtml) : "";
    const bodyHtml = safeHtml || plainTextToEmailHtml(bodyText);

    return NextResponse.json({ subject, bodyText, bodyHtml });
  }

  // Fallback: use best-effort subject extraction + plain text body.
  const fallbackLines = rawText
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const fallbackSubject =
    (fallbackLines[0] && fallbackLines[0].slice(0, 998)) ||
    (existingSubject?.slice(0, 998) ?? "Message");
  const fallbackBodyText = rawText.slice(0, 500_000);

  logInfo("gemini_ai_email_fallback_used", {
    userId: user.id,
    reason: "json_parse_failed",
  });

  return NextResponse.json({
    subject: fallbackSubject,
    bodyText: fallbackBodyText,
    bodyHtml: plainTextToEmailHtml(fallbackBodyText),
  });
}

