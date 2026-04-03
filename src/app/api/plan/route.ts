import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { formatUserEmail } from "@/lib/constants";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const isActive =
    user.plan === "business" &&
    (!user.planExpiresAt || user.planExpiresAt > now);
  return NextResponse.json({
    plan: isActive ? "business" : "free",
    planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
    email: formatUserEmail(user.localPart),
  });
}
