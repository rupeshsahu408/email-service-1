import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDisableDomainSending } from "@/lib/admin-domain-mutations";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  reason: z.string().max(2000).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { id } = await context.params;
  await adminDisableDomainSending({
    domainId: id,
    actorUserId: admin.id,
    reason: parsed.data.reason,
  });

  return NextResponse.json({ ok: true });
}
