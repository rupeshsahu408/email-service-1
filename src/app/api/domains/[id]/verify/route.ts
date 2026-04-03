import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { domains } from "@/db/schema";
import { recordDomainActivity } from "@/lib/domain-activity";
import { verifyDomainTxtRecord } from "@/lib/domain-dns";
import { runDomainDnsPipeline } from "@/lib/domain-state";
import { requireBusinessPlan } from "@/lib/plan";
import { getAuthContext } from "@/lib/session";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const gate = requireBusinessPlan(ctx.user);
  if (gate !== true) {
    return NextResponse.json(
      { error: gate.error, code: gate.code },
      { status: gate.status }
    );
  }

  const { id } = await context.params;
  const db = getDb();
  const row = await db
    .select()
    .from(domains)
    .where(and(eq(domains.id, id), eq(domains.ownerUserId, ctx.user.id)))
    .limit(1);

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
      actorType: "user",
      actorUserId: ctx.user.id,
      detail: `TXT verification succeeded for ${d.domainName}`,
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
    await runDomainDnsPipeline(id, {
      actorUserId: ctx.user.id,
      actorType: "user",
    });
  } catch {
    // Pipeline failure should not hide TXT result
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
