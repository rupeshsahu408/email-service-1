import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "@/db";
import {
  domainActivityLogs,
  domainDnsChecks,
  domainDiagnostics,
  domains,
  mailboxes,
  scheduledEmails,
  users,
} from "@/db/schema";
import { formatUserEmail } from "@/lib/constants";

export type AdminDomainListSort =
  | "newest"
  | "oldest"
  | "domain_name"
  | "last_check"
  | "verification_status";

export type AdminDomainVerificationFilter = "all" | "verified" | "unverified";
export type AdminDomainOperationalFilter = "all" | "active" | "suspended" | "pending";
export type AdminDomainSendingFilter = "all" | "enabled" | "disabled";
export type AdminDomainSendingSourceFilter = "all" | "admin" | "system";
export type AdminDomainRecordFilter = "all" | "pass" | "fail";

export type AdminDomainListParams = {
  page: number;
  pageSize: number;
  q?: string;
  verification: AdminDomainVerificationFilter;
  operational: AdminDomainOperationalFilter;
  sending: AdminDomainSendingFilter;
  sendingSource: AdminDomainSendingSourceFilter;
  spf: AdminDomainRecordFilter;
  dkim: AdminDomainRecordFilter;
  dmarc: AdminDomainRecordFilter;
  mx: AdminDomainRecordFilter;
  recentDays?: number;
  sort: AdminDomainListSort;
};

export type AdminDomainRow = {
  id: string;
  domainName: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerLocalPart: string;
  verificationStatus: string;
  operationalStatus: string;
  sendingEnabled: boolean;
  sendingDisabledSource: string | null;
  spfStatus: string | null;
  dkimStatus: string | null;
  dmarcStatus: string | null;
  mxStatus: string | null;
  createdAt: string;
  lastCheckAt: string | null;
};

function recordFilterSubquery(
  checkType: string,
  mode: "pass" | "fail"
) {
  if (mode === "pass") {
    return sql`exists (
      select 1 from ${domainDnsChecks} ddc
      where ddc.domain_id = ${domains.id}
        and ddc.check_type = ${checkType}
        and ddc.status = 'pass'
    )`;
  }
  return sql`(
    not exists (
      select 1 from ${domainDnsChecks} ddc
      where ddc.domain_id = ${domains.id}
        and ddc.check_type = ${checkType}
    )
    or exists (
      select 1 from ${domainDnsChecks} ddc
      where ddc.domain_id = ${domains.id}
        and ddc.check_type = ${checkType}
        and ddc.status in ('fail','error')
    )
  )`;
}

export type AdminDomainListFilterParams = Omit<
  AdminDomainListParams,
  "page" | "pageSize"
>;

function buildWhere(params: AdminDomainListFilterParams) {
  const conditions: ReturnType<typeof and>[] = [];

  if (params.verification === "verified") {
    conditions.push(eq(domains.verificationStatus, "verified"));
  } else if (params.verification === "unverified") {
    conditions.push(sql`${domains.verificationStatus} <> 'verified'`);
  }

  if (params.operational === "active") {
    conditions.push(eq(domains.operationalStatus, "active"));
  } else if (params.operational === "suspended") {
    conditions.push(eq(domains.operationalStatus, "suspended"));
  } else if (params.operational === "pending") {
    conditions.push(eq(domains.operationalStatus, "pending"));
  }

  if (params.sending === "enabled") {
    conditions.push(eq(domains.sendingEnabled, true));
  } else if (params.sending === "disabled") {
    conditions.push(eq(domains.sendingEnabled, false));
  }

  if (params.sendingSource === "admin") {
    conditions.push(eq(domains.sendingDisabledSource, "admin"));
  } else if (params.sendingSource === "system") {
    conditions.push(eq(domains.sendingDisabledSource, "system"));
  }

  if (params.spf !== "all") {
    conditions.push(recordFilterSubquery("spf", params.spf === "pass" ? "pass" : "fail"));
  }
  if (params.dkim !== "all") {
    conditions.push(recordFilterSubquery("dkim", params.dkim === "pass" ? "pass" : "fail"));
  }
  if (params.dmarc !== "all") {
    conditions.push(recordFilterSubquery("dmarc", params.dmarc === "pass" ? "pass" : "fail"));
  }
  if (params.mx !== "all") {
    conditions.push(recordFilterSubquery("mx", params.mx === "pass" ? "pass" : "fail"));
  }

  if (params.recentDays && params.recentDays > 0) {
    const since = new Date();
    since.setDate(since.getDate() - params.recentDays);
    conditions.push(gte(domains.createdAt, since));
  }

  const rawQ = params.q?.trim();
  if (rawQ) {
    const safe = rawQ.replace(/[%_\\]/g, "").trim() || rawQ;
    const pattern = `%${safe}%`;
    const uuidLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        rawQ
      );

    const searchOr = [
      ilike(domains.domainName, pattern),
      ilike(users.localPart, pattern),
      ilike(users.fullName, pattern),
    ];
    if (uuidLike) {
      searchOr.push(eq(domains.id, rawQ));
      searchOr.push(eq(users.id, rawQ));
    }
    conditions.push(or(...searchOr)!);
  }

  return conditions.length ? and(...conditions) : undefined;
}

function orderByClause(sort: AdminDomainListSort) {
  switch (sort) {
    case "oldest":
      return [asc(domains.createdAt)];
    case "domain_name":
      return [asc(domains.domainName)];
    case "last_check":
      return [sql`${domains.lastCheckAt} desc nulls last`, desc(domains.createdAt)];
    case "verification_status":
      return [asc(domains.verificationStatus), desc(domains.createdAt)];
    case "newest":
    default:
      return [desc(domains.createdAt)];
  }
}

export async function fetchCheckStatusesForDomains(
  domainIds: string[]
): Promise<
  Map<
    string,
    { spf: string | null; dkim: string | null; dmarc: string | null; mx: string | null }
  >
> {
  const map = new Map<
    string,
    { spf: string | null; dkim: string | null; dmarc: string | null; mx: string | null }
  >();
  if (domainIds.length === 0) return map;
  const db = getDb();
  const rows = await db
    .select({
      domainId: domainDnsChecks.domainId,
      checkType: domainDnsChecks.checkType,
      status: domainDnsChecks.status,
    })
    .from(domainDnsChecks)
    .where(inArray(domainDnsChecks.domainId, domainIds));

  for (const id of domainIds) {
    map.set(id, { spf: null, dkim: null, dmarc: null, mx: null });
  }
  for (const r of rows) {
    const m = map.get(r.domainId);
    if (!m) continue;
    if (r.checkType === "spf") m.spf = r.status;
    if (r.checkType === "dkim") m.dkim = r.status;
    if (r.checkType === "dmarc") m.dmarc = r.status;
    if (r.checkType === "mx") m.mx = r.status;
  }
  return map;
}

export async function listAdminDomains(
  params: AdminDomainListParams
): Promise<{
  rows: AdminDomainRow[];
  total: number;
}> {
  const db = getDb();
  const where = buildWhere(params);
  const order = orderByClause(params.sort);

  const totalRow = await db
    .select({ c: count() })
    .from(domains)
    .innerJoin(users, eq(domains.ownerUserId, users.id))
    .where(where);

  const total = Number(totalRow[0]?.c ?? 0);
  const offset = (params.page - 1) * params.pageSize;

  const baseRows = await db
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
    .where(where)
    .orderBy(...order)
    .limit(params.pageSize)
    .offset(offset);

  const ids = baseRows.map((r) => r.id);
  const checkMap = await fetchCheckStatusesForDomains(ids);

  const rows: AdminDomainRow[] = baseRows.map((r) => {
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

  return { rows, total };
}

export async function fetchAllAdminDomainsMatching(
  params: Omit<AdminDomainListParams, "page" | "pageSize">
): Promise<AdminDomainRow[]> {
  const db = getDb();
  const where = buildWhere(params);
  const order = orderByClause(params.sort);

  const baseRows = await db
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
    .where(where)
    .orderBy(...order);

  const ids = baseRows.map((r) => r.id);
  const checkMap = await fetchCheckStatusesForDomains(ids);

  return baseRows.map((r) => {
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
}

export async function getAdminDomainById(id: string) {
  const db = getDb();
  const row = await db
    .select({
      domain: domains,
      ownerLocalPart: users.localPart,
    })
    .from(domains)
    .innerJoin(users, eq(domains.ownerUserId, users.id))
    .where(eq(domains.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!row) return null;

  const checks = await db
    .select()
    .from(domainDnsChecks)
    .where(eq(domainDnsChecks.domainId, id))
    .orderBy(desc(domainDnsChecks.checkedAt), asc(domainDnsChecks.checkType));

  const latestDiag = await db
    .select()
    .from(domainDiagnostics)
    .where(eq(domainDiagnostics.domainId, id))
    .orderBy(desc(domainDiagnostics.computedAt))
    .limit(1)
    .then((r) => r[0] ?? null);

  const mailboxCount = await db
    .select({ c: count() })
    .from(mailboxes)
    .where(eq(mailboxes.domainId, id))
    .then((r) => Number(r[0]?.c ?? 0));

  const sentCount = await db
    .select({ c: count() })
    .from(scheduledEmails)
    .innerJoin(
      mailboxes,
      sql`${scheduledEmails.mailboxId} = ${mailboxes.id}::text`
    )
    .where(eq(mailboxes.domainId, id))
    .then((r) => Number(r[0]?.c ?? 0));

  const activity = await db
    .select()
    .from(domainActivityLogs)
    .where(eq(domainActivityLogs.domainId, id))
    .orderBy(desc(domainActivityLogs.createdAt))
    .limit(80);

  return {
    domain: row.domain,
    ownerEmail: formatUserEmail(row.ownerLocalPart),
    ownerLocalPart: row.ownerLocalPart,
    checks,
    latestDiagnostics: latestDiag,
    mailboxCount,
    linkedUsersCount: 1,
    scheduledSendCount: sentCount,
    activity,
  };
}
