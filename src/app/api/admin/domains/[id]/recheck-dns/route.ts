import { NextRequest, NextResponse } from "next/server";
import { recordDomainActivity } from "@/lib/domain-activity";
import { runDomainDnsPipeline } from "@/lib/domain-state";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    await recordDomainActivity({
      domainId: id,
      eventType: "dns_recheck",
      actorType: "admin",
      actorUserId: admin.id,
      detail: "DNS recheck requested",
    });
    const result = await runDomainDnsPipeline(id, {
      actorUserId: admin.id,
      actorType: "admin",
    });
    return NextResponse.json({ ok: true, health: result.health });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Recheck failed" },
      { status: 500 }
    );
  }
}
