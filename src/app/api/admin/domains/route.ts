import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { domains, users } from "@/db/schema";
import {
  buildDnsInstructionRecords,
  generateVerificationToken,
} from "@/lib/domain-dns";
import { recordAdminActivity } from "@/lib/admin-activity";
import { recordDomainActivity } from "@/lib/domain-activity";
import { runDomainDnsPipeline } from "@/lib/domain-state";
import {
  listAdminDomains,
  type AdminDomainListParams,
  type AdminDomainListSort,
} from "@/lib/admin-domains";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { adminCreateDomainBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/\.$/, "");
}

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
  verification: z.enum(["all", "verified", "unverified"]).default("all"),
  operational: z
    .enum(["all", "active", "suspended", "pending"])
    .default("all"),
  sending: z.enum(["all", "enabled", "disabled"]).default("all"),
  sendingSource: z.enum(["all", "admin", "system"]).default("all"),
  spf: z.enum(["all", "pass", "fail"]).default("all"),
  dkim: z.enum(["all", "pass", "fail"]).default("all"),
  dmarc: z.enum(["all", "pass", "fail"]).default("all"),
  mx: z.enum(["all", "pass", "fail"]).default("all"),
  recentDays: z.coerce.number().int().min(1).max(365).optional(),
  sort: z
    .enum([
      "newest",
      "oldest",
      "domain_name",
      "last_check",
      "verification_status",
    ])
    .default("newest"),
});

function parseListParams(sp: URLSearchParams): AdminDomainListParams {
  const raw = Object.fromEntries(sp.entries());
  const parsed = listQuerySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("BAD_QUERY");
  }
  const d = parsed.data;
  return {
    page: d.page,
    pageSize: d.pageSize,
    q: d.q,
    verification: d.verification,
    operational: d.operational,
    sending: d.sending,
    sendingSource: d.sendingSource,
    spf: d.spf,
    dkim: d.dkim,
    dmarc: d.dmarc,
    mx: d.mx,
    recentDays: d.recentDays,
    sort: d.sort as AdminDomainListSort,
  };
}

export async function GET(request: NextRequest) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let params: AdminDomainListParams;
  try {
    params = parseListParams(request.nextUrl.searchParams);
  } catch {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const { rows, total } = await listAdminDomains(params);
  return NextResponse.json({
    domains: rows,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  });
}

export async function POST(request: NextRequest) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = adminCreateDomainBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const domainName = normalizeDomain(parsed.data.domainName);
  if (!DOMAIN_RE.test(domainName)) {
    return NextResponse.json({ error: "Invalid domain name" }, { status: 400 });
  }

  const db = getDb();
  const owner = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, parsed.data.ownerUserId))
    .limit(1);
  if (owner.length === 0) {
    return NextResponse.json({ error: "Owner user not found" }, { status: 404 });
  }

  const token = generateVerificationToken();
  const dns = buildDnsInstructionRecords(domainName, token);
  const dkimSel =
    process.env.DOMAIN_DKIM_SELECTOR?.trim().toLowerCase() || "resend";
  const now = new Date();

  try {
    const [row] = await db
      .insert(domains)
      .values({
        ownerUserId: parsed.data.ownerUserId,
        domainName,
        verificationStatus: "dns_pending",
        verificationToken: token,
        dnsRecordsSnapshot: dns.records,
        operationalStatus: "pending",
        sendingEnabled: false,
        dkimSelector: dkimSel,
        adminNotes: parsed.data.adminNotes?.trim() || null,
        updatedAt: now,
      })
      .returning();

    await recordDomainActivity({
      domainId: row!.id,
      eventType: "domain_added",
      actorType: "admin",
      actorUserId: admin.id,
      detail: `Domain ${domainName} created for user ${parsed.data.ownerUserId}`,
    });
    await recordAdminActivity({
      eventType: "domain_added",
      actorUserId: admin.id,
      subjectUserId: parsed.data.ownerUserId,
      detail: `Admin added domain ${domainName}`,
      meta: { domainId: row!.id, domainName },
    });

    try {
      await runDomainDnsPipeline(row!.id, { actorUserId: admin.id, actorType: "admin" });
    } catch {
      // ignore
    }

    const fresh = await db
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
