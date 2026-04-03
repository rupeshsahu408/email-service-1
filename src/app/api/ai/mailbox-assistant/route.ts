import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { geminiGenerateContent } from "@/lib/gemini-json-client";
import { cacheGetJson, cacheSetJson, shortHashKey } from "@/lib/ai-result-cache";
import { rateLimitAiWrite } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { getUserAnalytics, type UserAnalyticsRange } from "@/lib/user-analytics";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  question: z.string().max(800),
  range: z.enum(["today", "7d", "30d"]).optional(),
});

function compactStats(a: Awaited<ReturnType<typeof getUserAnalytics>>) {
  return {
    range: a.range,
    received: a.summary.emailsReceived,
    sent: a.summary.emailsSent,
    spam: a.summary.spamEmails,
    contacts: a.summary.contactsCount,
    avgReplyMs: a.response.averageReplyTimeMs,
    unread: a.productivity.unreadEmailsCount,
    waitingReply: a.actionInsights.waitingForReplyCount,
    pending24h: a.actionInsights.pendingOver24HoursCount,
    topContacts: a.topContacts.slice(0, 5),
    mostActiveSender: a.mostActiveSender,
    categoryTop: a.phase3.categories.topCategory,
    categoryTotal: a.phase3.categories.total,
  };
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimitAiWrite(user.id);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many AI requests. Try later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const range = (parsed.data.range ?? "7d") as UserAnalyticsRange;
  const q = parsed.data.question.trim();
  if (!q) {
    return NextResponse.json({ error: "Empty question" }, { status: 400 });
  }

  const cacheKey = `ai:mboxasst:${user.id}:${shortHashKey([range, q.toLowerCase().slice(0, 800)])}`;

  try {
    const cached = await cacheGetJson<{ answer: string }>(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true, label: "AI" });
    }

    if (!process.env.GEMINI_API_KEY?.trim()) {
      return NextResponse.json(
        {
          answer:
            "AI assistant needs GEMINI_API_KEY on the server. You can still use inbox search and analytics.",
          label: "AI",
          fallback: true,
        },
        { status: 200 }
      );
    }

    const analytics = await getUserAnalytics(user.id, user.localPart, range, {
      useAiCategories: false,
    });
    const statsJson = JSON.stringify(compactStats(analytics));

    const prompt = [
      "You are Sendora's concise mailbox assistant. Answer using ONLY the JSON stats; if something isn't in the data, say you don't have that detail.",
      "Plain text, short paragraphs or bullets, no markdown code fences, under 180 words.",
      "If they ask who they talk to most, use topContacts / mostActiveSender.",
      "Pending / waiting = waitingReply and pending24h.",
      "",
      `Stats JSON:\n${statsJson}`,
      "",
      `User question: ${q.slice(0, 800)}`,
    ].join("\n");

    const gen = await geminiGenerateContent(prompt, 700);
    if (!gen.ok) {
      return NextResponse.json(
        { error: "Assistant temporarily unavailable.", label: "AI" },
        { status: 503 }
      );
    }

    const answer = gen.text.trim().slice(0, 4000);
    await cacheSetJson(cacheKey, { answer }, 300);

    return NextResponse.json({ answer, cached: false, label: "AI" });
  } catch (e) {
    logError("mailbox_assistant_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json(
      { error: "Could not run assistant." },
      { status: 500 }
    );
  }
}
