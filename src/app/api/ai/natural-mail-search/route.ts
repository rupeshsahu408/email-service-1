import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { planNaturalMailSearch } from "@/lib/ai-nl-mail-search";
import { cacheGetJson, cacheSetJson, shortHashKey } from "@/lib/ai-result-cache";
import { rateLimitAiWrite } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  query: z.string().max(500),
});

type CacheShape = {
  q: string;
  folder?: string;
  sinceIso?: string;
  untilIso?: string;
};

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

  const qNorm = parsed.data.query.trim().toLowerCase().slice(0, 500);
  const cacheKey = `ai:nlms:${user.id}:${shortHashKey([qNorm])}`;

  try {
    const cached = await cacheGetJson<CacheShape>(cacheKey);
    if (cached) {
      return NextResponse.json({
        plan: cached,
        cached: true,
        label: "AI",
      });
    }

    const hasKey = !!process.env.GEMINI_API_KEY?.trim();
    const plan = await planNaturalMailSearch(parsed.data.query);
    const ttl = 600;
    await cacheSetJson(cacheKey, plan, ttl);

    return NextResponse.json({
      plan,
      cached: false,
      label: "AI",
      modelUsed: hasKey,
    });
  } catch (e) {
    logError("natural_mail_search_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json({ error: "Could not parse search." }, { status: 500 });
  }
}
