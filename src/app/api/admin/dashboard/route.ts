import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/session";
import { getAdminDashboardData } from "@/lib/admin-dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getAdminDashboardData();
    return NextResponse.json(
      { ok: true, data },
      { headers: { "cache-control": "no-store, max-age=0" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error("[admin/dashboard] failed:", message);
    return NextResponse.json(
      { ok: false, error: "Could not load admin dashboard data.", detail: message },
      {
        status: 500,
        headers: { "cache-control": "no-store, max-age=0" },
      }
    );
  }
}
