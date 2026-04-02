import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { browserAccountLinks } from "@/db/schema";
import {
  attachSessionCookie,
  getAuthContext,
  getOrCreateAccountBundleId,
  issueSession,
} from "@/lib/session";

const switchSchema = z.object({
  userId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = switchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const bundleId = await getOrCreateAccountBundleId();
  const exists = await getDb()
    .select({ userId: browserAccountLinks.userId })
    .from(browserAccountLinks)
    .where(
      and(
        eq(browserAccountLinks.bundleId, bundleId),
        eq(browserAccountLinks.userId, parsed.data.userId)
      )
    )
    .limit(1);
  if (exists.length === 0) {
    return NextResponse.json({ error: "Account not linked to this browser." }, { status: 404 });
  }

  const ua = request.headers.get("user-agent") ?? undefined;
  const ipHint = request.headers.get("x-forwarded-for") ?? undefined;
  const issued = await issueSession(parsed.data.userId, { userAgent: ua, ipHint });
  const res = NextResponse.json({ ok: true });
  attachSessionCookie(res, issued.token, issued.expiresAt);
  return res;
}
