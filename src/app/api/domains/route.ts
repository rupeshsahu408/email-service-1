import { NextRequest, NextResponse } from "next/server";
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { domains } from "@/db/schema";
import {
  buildDnsInstructionRecords,
  generateVerificationToken,
} from "@/lib/domain-dns";
import { requireBusinessPlan } from "@/lib/plan";
import { getAuthContext } from "@/lib/session";
import { recordAdminActivity } from "@/lib/admin-activity";
import { fetchCheckStatusesForDomains } from "@/lib/admin-domains";
import { recordDomainActivity } from "@/lib/domain-activity";
import { runDomainDnsPipeline } from "@/lib/domain-state";
import { getAdminSystemSettings } from "@/lib/admin-system-settings";
import { enforceApiUsageLimitForUser } from "@/lib/api-usage-limit";

const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/\.$/, "");
}

const postSchema = z.object({
  domainName: z.string().min(3).max(255),
});

export async function GET() {
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

  const apiLimit = await enforceApiUsageLimitForUser(ctx.user.id);
  if (!apiLimit.allowed) {
    return NextResponse.json(
      { error: "API request limit reached for today." },
      { status: 429 }
    );
  }

  const rows = await getDb()
    .select()
    .from(domains)
    .where(eq(domains.ownerUserId, ctx.user.id))
    .orderBy(desc(domains.createdAt));

  const ids = rows.map((r) => r.id);
  const checkMap = await fetchCheckStatusesForDomains(ids);

  const withDns = rows.map((row) => ({
    ...row,
    dnsUi: buildDnsInstructionRecords(row.domainName, row.verificationToken),
    dnsCheckSummary: checkMap.get(row.id) ?? {
      spf: null,
      dkim: null,
      dmarc: null,
      mx: null,
    },
  }));

  return NextResponse.json({ domains: withDns });
}

export async function POST(request: NextRequest) {
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

  const apiLimit = await enforceApiUsageLimitForUser(ctx.user.id);
  if (!apiLimit.allowed) {
    return NextResponse.json(
      { error: "API request limit reached for today." },
      { status: 429 }
    );
  }

  const settings = await getAdminSystemSettings();
  const domainCountRows = await getDb()
    .select({ c: count() })
    .from(domains)
    .where(eq(domains.ownerUserId, ctx.user.id));
  if (Number(domainCountRows[0]?.c ?? 0) >= settings.limits.maxDomainsPerUser) {
    return NextResponse.json(
      { error: "Domain limit reached for this account." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const domainName = normalizeDomain(parsed.data.domainName);
  if (!DOMAIN_RE.test(domainName)) {
    return NextResponse.json({ error: "Invalid domain name" }, { status: 400 });
  }

  const token = generateVerificationToken();
  const dns = buildDnsInstructionRecords(domainName, token);
  const now = new Date();

  try {
    const dkimSel =
      process.env.DOMAIN_DKIM_SELECTOR?.trim().toLowerCase() || "resend";

    const [row] = await getDb()
      .insert(domains)
      .values({
        ownerUserId: ctx.user.id,
        domainName,
        verificationStatus: "dns_pending",
        verificationToken: token,
        dnsRecordsSnapshot: dns.records,
        operationalStatus: "pending",
        sendingEnabled: false,
        dkimSelector: dkimSel,
        updatedAt: now,
      })
      .returning();

    await recordDomainActivity({
      domainId: row!.id,
      eventType: "domain_added",
      actorType: "user",
      actorUserId: ctx.user.id,
      detail: `Domain added: ${domainName}`,
    });

    await recordAdminActivity({
      eventType: "domain_added",
      severity: "info",
      actorUserId: ctx.user.id,
      detail: `Domain added: ${domainName}`,
      meta: { domainName, ownerUserId: ctx.user.id, domainId: row!.id },
    });

    try {
      await runDomainDnsPipeline(row!.id, {
        actorUserId: ctx.user.id,
        actorType: "user",
      });
    } catch {
      // ignore
    }

    const fresh = await getDb()
      .select()
      .from(domains)
      .where(eq(domains.id, row!.id))
      .limit(1);

    return NextResponse.json({
      domain: fresh[0],
      dnsUi: dns,
    });
  } catch {
    return NextResponse.json(
      { error: "Domain may already be registered" },
      { status: 409 }
    );
  }
}
