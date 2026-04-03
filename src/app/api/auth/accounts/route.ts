import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { browserAccountLinks, users } from "@/db/schema";
import { ACCOUNT_BUNDLE_COOKIE, formatUserEmail } from "@/lib/constants";
import {
  attachAccountBundleCookie,
  getAuthContext,
  getOrCreateAccountBundleId,
  linkAccountToBundle,
} from "@/lib/session";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cookieStore = await cookies();
  const hadBundleCookie = Boolean(cookieStore.get(ACCOUNT_BUNDLE_COOKIE)?.value);
  const bundleId = await getOrCreateAccountBundleId();
  await linkAccountToBundle(bundleId, ctx.user.id);
  const rows = await getDb()
    .select({
      userId: users.id,
      localPart: users.localPart,
      avatarUrl: users.avatarUrl,
    })
    .from(browserAccountLinks)
    .innerJoin(users, eq(browserAccountLinks.userId, users.id))
    .where(eq(browserAccountLinks.bundleId, bundleId));

  const res = NextResponse.json({
    accounts: rows.map((r) => ({
      userId: r.userId,
      email: formatUserEmail(r.localPart),
      avatarUrl: r.avatarUrl,
      isCurrent: r.userId === ctx.user.id,
    })),
  });
  if (!hadBundleCookie) {
    attachAccountBundleCookie(res, bundleId);
  }
  return res;
}

export async function DELETE(request: NextRequest) {
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
  const userId = typeof (body as { userId?: unknown })?.userId === "string"
    ? (body as { userId: string }).userId
    : "";
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (userId === ctx.user.id) {
    return NextResponse.json(
      { error: "Switch to another account before removing current one." },
      { status: 400 }
    );
  }

  const bundleId = await getOrCreateAccountBundleId();
  await getDb()
    .delete(browserAccountLinks)
    .where(
      and(
        eq(browserAccountLinks.bundleId, bundleId),
        eq(browserAccountLinks.userId, userId)
      )
    );
  return NextResponse.json({ ok: true });
}
