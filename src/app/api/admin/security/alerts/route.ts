import { NextResponse } from "next/server";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { getSecurityAlerts } from "@/lib/admin-security";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const alerts = await getSecurityAlerts();
  return NextResponse.json({ alerts });
}
