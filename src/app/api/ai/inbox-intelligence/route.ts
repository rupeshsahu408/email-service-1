import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import {
  batchAiInboxTips,
  computeInboxIntelligenceRules,
  type InboxIntelligenceRow,
} from "@/lib/inbox-intelligence";
import { formatUserEmail } from "@/lib/constants";
import { cacheGetJson, cacheSetJson, shortHashKey } from "@/lib/ai-result-cache";
import { rateLimitAiWrite } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { parsePrimaryEmail } from "@/lib/mail-filter";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(36),
  useAiTips: z.boolean().optional(),
});

const TOP_SENDER_DAYS = 90;

async function loadImportantSenders(
  userId: string,
  selfLower: string
): Promise<Set<string>> {
  const db = getDb();
  const since = new Date(Date.now() - TOP_SENDER_DAYS * 86400000);
  const rows = await db
    .select({
      fromAddr: messages.fromAddr,
      n: count(),
    })
    .from(messages)
    .where(
      and(
        eq(messages.userId, userId),
        gte(messages.createdAt, since),
        inArray(messages.folder, ["inbox", "archive"])
      )
    )
    .groupBy(messages.fromAddr)
    .orderBy(desc(count()))
    .limit(24);

  const set = new Set<string>();
  for (const r of rows) {
    const e = parsePrimaryEmail(r.fromAddr ?? "");
    if (e && e.includes("@") && e !== selfLower) set.add(e);
  }
  return set;
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

  const selfLower = formatUserEmail(user.localPart).toLowerCase();
  const wantAi =
    parsed.data.useAiTips === true && !!process.env.GEMINI_API_KEY?.trim();

  const cacheKey = `ai:inboxi:${user.id}:${shortHashKey([
    [...parsed.data.ids].sort().join(","),
    wantAi ? "1" : "0",
  ])}`;

  try {
    if (!wantAi) {
      const cached = await cacheGetJson<{ rows: InboxIntelligenceRow[] }>(cacheKey);
      if (cached) {
        return NextResponse.json({ ...cached, cached: true, label: "AI" });
      }
    }

    const db = getDb();
    const idList = [...new Set(parsed.data.ids)];
    const loaded = await db
      .select({
        id: messages.id,
        folder: messages.folder,
        subject: sql<string>`coalesce(${messages.subject}, '')`,
        snippet: messages.snippet,
        fromAddr: sql<string>`coalesce(${messages.fromAddr}, '')`,
        readAt: messages.readAt,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(eq(messages.userId, user.id), inArray(messages.id, idList)));

    if (loaded.length === 0) {
      return NextResponse.json({ rows: [] as InboxIntelligenceRow[] });
    }

    const important = await loadImportantSenders(user.id, selfLower);
    const rules = computeInboxIntelligenceRules(loaded, important, selfLower);

    const rows: InboxIntelligenceRow[] = [];
    const forAi: Array<{
      id: string;
      subject: string;
      fromLine: string;
      ruleSummary: string;
    }> = [];

    for (const m of loaded) {
      const base = rules.get(m.id);
      if (!base) continue;
      const tips = [...base.tips];
      let usedAiTip = false;

      const eligibleAi =
        wantAi &&
        m.folder === "inbox" &&
        m.readAt === null &&
        (base.priority === "high" || base.priority === "medium");

      if (eligibleAi) {
        forAi.push({
          id: m.id,
          subject: m.subject,
          fromLine: m.fromAddr,
          ruleSummary: `${base.priority}: ${base.priorityNote}`,
        });
      }

      rows.push({
        ...base,
        tips,
        usedAiTip,
      });
    }

    if (forAi.length > 0) {
      const capped = forAi.slice(0, 14);
      const aiTips = await batchAiInboxTips(capped);
      for (const r of rows) {
        const extra = aiTips.get(r.id);
        if (extra) {
          r.tips = [`[AI] ${extra}`, ...r.tips].slice(0, 2);
          r.usedAiTip = true;
        }
      }
    }

    if (!wantAi) {
      await cacheSetJson(cacheKey, { rows }, 120);
    }

    return NextResponse.json({ rows, cached: false, label: "AI" });
  } catch (e) {
    logError("inbox_intelligence_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json(
      { error: "Could not compute inbox intelligence." },
      { status: 500 }
    );
  }
}
