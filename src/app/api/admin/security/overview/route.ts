import { NextResponse } from "next/server";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { getSecurityOverview } from "@/lib/admin-security";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await getSecurityOverview();
  return NextResponse.json(data);
}
