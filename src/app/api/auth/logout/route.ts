import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import { logError } from "@/lib/logger";
import {
  clearSessionCookieOnResponse,
  deleteSessionRowByRawToken,
} from "@/lib/session";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    await deleteSessionRowByRawToken(token);
  } catch (e) {
    logError("auth_logout_db_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookieOnResponse(res);
  return res;
}
