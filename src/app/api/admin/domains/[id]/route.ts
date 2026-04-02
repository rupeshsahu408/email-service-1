import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { domains } from "@/db/schema";
import { getAdminDomainById } from "@/lib/admin-domains";
import { buildDnsInstructionRecords } from "@/lib/domain-dns";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  adminNotes: z.string().max(20_000).nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const detail = await getAdminDomainById(id);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const dnsUi = buildDnsInstructionRecords(
    detail.domain.domainName,
    detail.domain.verificationToken
  );

  return NextResponse.json({ ...detail, dnsUi });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = await db
    .select({ id: domains.id })
    .from(domains)
    .where(eq(domains.id, id))
    .limit(1);
  if (existing.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const set: { adminNotes?: string | null; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (parsed.data.adminNotes !== undefined) {
    set.adminNotes = parsed.data.adminNotes ?? null;
  }
  await db.update(domains).set(set).where(eq(domains.id, id));

  const detail = await getAdminDomainById(id);
  return NextResponse.json({ domain: detail?.domain });
}
