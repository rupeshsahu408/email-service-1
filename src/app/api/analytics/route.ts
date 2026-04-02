import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getUserAnalytics } from "@/lib/user-analytics";
import { getCurrentUser } from "@/lib/session";
import {
  tryResolveMailboxAccess,
  canViewTeamAnalytics,
} from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

const rangeSchema = z.enum(["today", "7d", "30d"]);

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = rangeSchema.safeParse(searchParams.get("range") ?? "7d");
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const range = parsed.data;
  const useAiCategories = searchParams.get("ai") === "1";
  const rawFor = searchParams.get("forUserId");
  const forUserId =
    rawFor && /^[0-9a-f-]{36}$/i.test(rawFor) ? rawFor : null;

  let analyticsUserId = user.id;
  let localPart = user.localPart;
  if (forUserId && forUserId !== user.id) {
    const access = await tryResolveMailboxAccess(user.id, forUserId);
    if (!access || !canViewTeamAnalytics(access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    analyticsUserId = access.inboxOwnerUserId;
    const [row] = await getDb()
      .select({ localPart: users.localPart })
      .from(users)
      .where(eq(users.id, analyticsUserId))
      .limit(1);
    if (row) localPart = row.localPart;
  }

  try {
    const data = await getUserAnalytics(analyticsUserId, localPart, range, {
      useAiCategories,
    });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Could not load analytics" },
      { status: 500 }
    );
  }
}
