import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { logError } from "@/lib/logger";
import { getAuthContext, clearSessionCookieOnResponse } from "@/lib/session";

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await getDb().delete(sessions).where(eq(sessions.userId, ctx.user.id));
  } catch (e) {
    logError("sessions_revoke_all_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    const res = NextResponse.json(
      { error: "Could not revoke sessions." },
      { status: 500 }
    );
    clearSessionCookieOnResponse(res);
    return res;
  }
  const res = NextResponse.json({ ok: true, loggedOutEverywhere: true });
  clearSessionCookieOnResponse(res);
  return res;
}
