import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { domains } from "@/db/schema";
import { recordAdminActivity } from "@/lib/admin-activity";
import { recordDomainActivity } from "@/lib/domain-activity";
import { verifyDomainTxtRecord } from "@/lib/domain-dns";
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
  const db = getDb();
  const row = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
  if (row.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const d = row[0]!;
  const now = new Date();

  await db
    .update(domains)
    .set({ verificationStatus: "verifying", lastCheckAt: now, updatedAt: now })
    .where(eq(domains.id, id));

  const result = await verifyDomainTxtRecord(d.domainName, d.verificationToken);

  if (result.ok) {
    await db
      .update(domains)
      .set({
        verificationStatus: "verified",
        verifiedAt: now,
        lastCheckAt: now,
        failureReason: null,
        updatedAt: now,
      })
      .where(eq(domains.id, id));
    await recordDomainActivity({
      domainId: id,
      eventType: "domain_verified",
      actorType: "admin",
      actorUserId: admin.id,
      detail: `TXT verification succeeded for ${d.domainName}`,
    });
    await recordAdminActivity({
      eventType: "domain_verified",
      actorUserId: admin.id,
      detail: `Domain ${d.domainName} verified`,
      meta: { domainId: id },
    });
  } else {
    await db
      .update(domains)
      .set({
        verificationStatus: "failed",
        lastCheckAt: now,
        failureReason: result.reason ?? "Verification failed",
        updatedAt: now,
      })
      .where(eq(domains.id, id));
  }

  try {
    await runDomainDnsPipeline(id, { actorUserId: admin.id, actorType: "admin" });
  } catch {
    // ignore
  }

  const finalRow = await db
    .select()
    .from(domains)
    .where(eq(domains.id, id))
    .limit(1);

  if (result.ok) {
    return NextResponse.json({ ok: true, domain: finalRow[0] });
  }
  return NextResponse.json({
    ok: false,
    domain: finalRow[0],
    reason: result.reason,
  });
}
