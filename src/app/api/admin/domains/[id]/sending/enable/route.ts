import { NextRequest, NextResponse } from "next/server";
import { adminEnableDomainSending } from "@/lib/admin-domain-mutations";
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
  await adminEnableDomainSending({ domainId: id, actorUserId: admin.id });

  return NextResponse.json({ ok: true });
}
