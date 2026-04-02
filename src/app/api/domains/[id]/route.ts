import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { domains, mailboxes } from "@/db/schema";
import { fetchCheckStatusesForDomains } from "@/lib/admin-domains";
import { buildDnsInstructionRecords } from "@/lib/domain-dns";
import { requireBusinessPlan } from "@/lib/plan";
import { getAuthContext } from "@/lib/session";

export async function GET(
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
  const row = await getDb()
    .select()
    .from(domains)
    .where(and(eq(domains.id, id), eq(domains.ownerUserId, ctx.user.id)))
    .limit(1);

  if (row.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const d = row[0]!;
  const dnsUi = buildDnsInstructionRecords(d.domainName, d.verificationToken);
  const checkMap = await fetchCheckStatusesForDomains([d.id]);
  return NextResponse.json({
    domain: d,
    dnsUi,
    dnsCheckSummary:
      checkMap.get(d.id) ?? {
        spf: null,
        dkim: null,
        dmarc: null,
        mx: null,
      },
  });
}

export async function DELETE(
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
  const deleted = await getDb()
    .delete(domains)
    .where(and(eq(domains.id, id), eq(domains.ownerUserId, ctx.user.id)))
    .returning({ id: domains.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
