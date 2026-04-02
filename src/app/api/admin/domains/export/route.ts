import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { domains, users } from "@/db/schema";
import {
  fetchAllAdminDomainsMatching,
  fetchCheckStatusesForDomains,
  type AdminDomainListParams,
  type AdminDomainListSort,
} from "@/lib/admin-domains";
import { formatUserEmail } from "@/lib/constants";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";

export const dynamic = "force-dynamic";

const filterQuerySchema = z.object({
  ids: z.string().optional(),
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

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: NextRequest) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const raw = Object.fromEntries(sp.entries());
  const parsed = filterQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const idsParam = parsed.data.ids?.trim();
  let rows: Awaited<ReturnType<typeof fetchAllAdminDomainsMatching>>;

  if (idsParam) {
    const ids = idsParam
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const uuidOk =
      ids.length > 0 &&
      ids.every((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id
        )
      );
    if (!uuidOk) {
      return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
    }
    const db = getDb();
    const base = await db
      .select({
        id: domains.id,
        domainName: domains.domainName,
        ownerUserId: domains.ownerUserId,
        ownerLocalPart: users.localPart,
        verificationStatus: domains.verificationStatus,
        operationalStatus: domains.operationalStatus,
        sendingEnabled: domains.sendingEnabled,
        sendingDisabledSource: domains.sendingDisabledSource,
        createdAt: domains.createdAt,
        lastCheckAt: domains.lastCheckAt,
      })
      .from(domains)
      .innerJoin(users, eq(domains.ownerUserId, users.id))
      .where(inArray(domains.id, ids));

    const checkMap = await fetchCheckStatusesForDomains(ids);

    rows = base.map((r) => {
      const ck = checkMap.get(r.id);
      return {
        id: r.id,
        domainName: r.domainName,
        ownerUserId: r.ownerUserId,
        ownerEmail: formatUserEmail(r.ownerLocalPart),
        ownerLocalPart: r.ownerLocalPart,
        verificationStatus: r.verificationStatus,
        operationalStatus: r.operationalStatus,
        sendingEnabled: r.sendingEnabled,
        sendingDisabledSource: r.sendingDisabledSource,
        spfStatus: ck?.spf ?? null,
        dkimStatus: ck?.dkim ?? null,
        dmarcStatus: ck?.dmarc ?? null,
        mxStatus: ck?.mx ?? null,
        createdAt: r.createdAt.toISOString(),
        lastCheckAt: r.lastCheckAt?.toISOString() ?? null,
      };
    });
  } else {
    const d = parsed.data;
    const params: Omit<AdminDomainListParams, "page" | "pageSize"> = {
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
    rows = await fetchAllAdminDomainsMatching(params);
  }

  const header = [
    "domain_id",
    "domain_name",
    "owner_email",
    "verification_status",
    "spf",
    "dkim",
    "dmarc",
    "mx",
    "operational_status",
    "sending_enabled",
    "sending_disabled_source",
    "created_at",
    "last_check_at",
  ];

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.id,
        r.domainName,
        r.ownerEmail,
        r.verificationStatus,
        r.spfStatus ?? "",
        r.dkimStatus ?? "",
        r.dmarcStatus ?? "",
        r.mxStatus ?? "",
        r.operationalStatus,
        r.sendingEnabled ? "true" : "false",
        r.sendingDisabledSource ?? "",
        r.createdAt,
        r.lastCheckAt ?? "",
      ]
        .map((x) => csvEscape(String(x)))
        .join(",")
    ),
  ];

  const csv = lines.join("\r\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="domains-export.csv"`,
    },
  });
}
