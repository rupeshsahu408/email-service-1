import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserAnalytics } from "@/lib/user-analytics";
import { getCurrentUser } from "@/lib/session";

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

  try {
    const data = await getUserAnalytics(user.id, user.localPart, range);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Could not load analytics" },
      { status: 500 }
    );
  }
}
