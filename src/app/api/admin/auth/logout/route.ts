import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  clearAdminSessionCookieOnResponse,
  deleteSessionRowByRawToken,
} from "@/lib/session";
import { ADMIN_SESSION_COOKIE } from "@/lib/constants";

export async function POST() {
  const cookieStore = await cookies();
  const rawAdminToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  await deleteSessionRowByRawToken(rawAdminToken);
  const res = NextResponse.json({ ok: true });
  clearAdminSessionCookieOnResponse(res);
  return res;
}
