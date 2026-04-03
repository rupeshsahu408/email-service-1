import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "@/db";
import {
  authLoginEvents,
  sessions,
  users,
} from "@/db/schema";

export type SecurityAlert = {
  id: string;
  severity: "high" | "medium" | "low";
  reason: string;
  timestamp: string;
  relatedUserId: string | null;
  relatedIp: string | null;
  evidence: Record<string, number | string | null>;
};

export type HighRiskUser = {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    isSuspended: boolean;
    securityLockedUntil: string | null;
  };
  score: number;
  breakdown: Record<string, number>;
};

const BRUTE_IP_WINDOW_MIN = 15;
const BRUTE_IP_THRESHOLD = 5;
const BRUTE_ID_WINDOW_MIN = 60;
const BRUTE_ID_THRESHOLD = 8;
const MANY_DEVICES_THRESHOLD = 4;
const MANY_DEVICES_HOURS = 24;

/** Raw SQL via postgres-js often returns timestamptz as ISO strings, not Date. */
function coercePgTimestamp(value: unknown): Date {
  if (value instanceof Date) return value;
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

export async function getSecurityOverview(): Promise<{
  activeSessions: number;
  failedLast24h: number;
  alertsCount: number;
  highRiskCount: number;
}> {
  const db = getDb();
  const since24h = sql`now() - interval '24 hours'`;

  const [sessRow] = await db
    .select({ n: count() })
    .from(sessions)
    .where(gte(sessions.expiresAt, sql`now()`));

  const [failRow] = await db
    .select({ n: count() })
    .from(authLoginEvents)
    .where(
      and(
        eq(authLoginEvents.outcome, "failed"),
        gte(authLoginEvents.createdAt, since24h)
      )
    );

  const alerts = await getSecurityAlerts();
  const highRisk = await getHighRiskUsers(100);

  return {
    activeSessions: Number(sessRow?.n ?? 0),
    failedLast24h: Number(failRow?.n ?? 0),
    alertsCount: alerts.length,
    highRiskCount: highRisk.length,
  };
}

/** IPs with repeated failed logins in a short window. */
async function bruteForceIps(): Promise<
  { ip: string; failures: number; windowMin: number }[]
> {
  const db = getDb();
  const since = sql`now() - interval '15 minutes'`;
  const rows = await db
    .select({
      ip: authLoginEvents.ipHint,
      n: count(),
    })
    .from(authLoginEvents)
    .where(
      and(
        eq(authLoginEvents.outcome, "failed"),
        isNotNull(authLoginEvents.ipHint),
        gte(authLoginEvents.createdAt, since)
      )
    )
    .groupBy(authLoginEvents.ipHint)
    .having(sql`count(*)::int >= ${BRUTE_IP_THRESHOLD}`);
  return rows.map((r) => ({
    ip: r.ip!,
    failures: Number(r.n),
    windowMin: BRUTE_IP_WINDOW_MIN,
  }));
}

/** Identifiers with many failed attempts. */
async function bruteForceIdentifiers(): Promise<
  { identifier: string; failures: number; windowMin: number }[]
> {
  const db = getDb();
  const since = sql`now() - interval '60 minutes'`;
  const rows = await db
    .select({
      identifier: authLoginEvents.identifier,
      n: count(),
    })
    .from(authLoginEvents)
    .where(
      and(eq(authLoginEvents.outcome, "failed"), gte(authLoginEvents.createdAt, since))
    )
    .groupBy(authLoginEvents.identifier)
    .having(sql`count(*)::int >= ${BRUTE_ID_THRESHOLD}`);
  return rows.map((r) => ({
    identifier: r.identifier,
    failures: Number(r.n),
    windowMin: BRUTE_ID_WINDOW_MIN,
  }));
}

async function manyDevicesUsers(): Promise<
  { userId: string; distinctAgents: number }[]
> {
  const db = getDb();
  const since = sql`now() - interval '24 hours'`;
  const rows = await db
    .select({
      userId: authLoginEvents.userId,
      n: sql<number>`count(distinct coalesce(${authLoginEvents.userAgent}, ''))::int`.mapWith(
        Number
      ),
    })
    .from(authLoginEvents)
    .where(
      and(
        eq(authLoginEvents.outcome, "success"),
        isNotNull(authLoginEvents.userId),
        gte(authLoginEvents.createdAt, since)
      )
    )
    .groupBy(authLoginEvents.userId)
    .having(
      sql`count(distinct coalesce(${authLoginEvents.userAgent}, ''))::int >= ${MANY_DEVICES_THRESHOLD}`
    );
  return rows.map((r) => ({
    userId: r.userId!,
    distinctAgents: r.n,
  }));
}

/** Successful login from an IP not seen in any prior success for that user. */
async function newLocationEvents(): Promise<
  { userId: string; ip: string; at: Date }[]
> {
  const db = getDb();
  const rows = await db.execute(
    sql`
    SELECT e.user_id, e.ip_hint, e.created_at
    FROM auth_login_events e
    WHERE e.outcome = 'success'
      AND e.user_id IS NOT NULL
      AND e.ip_hint IS NOT NULL
      AND e.created_at >= now() - interval '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM auth_login_events p
        WHERE p.user_id = e.user_id
          AND p.outcome = 'success'
          AND p.ip_hint = e.ip_hint
          AND p.created_at < e.created_at
      )
  `
  );
  const out: { userId: string; ip: string; at: Date }[] = [];
  for (const r of rows as unknown as {
    user_id: string;
    ip_hint: string;
    created_at: unknown;
  }[]) {
    out.push({
      userId: r.user_id,
      ip: r.ip_hint,
      at: coercePgTimestamp(r.created_at),
    });
  }
  return out;
}

export async function getSecurityAlerts(): Promise<SecurityAlert[]> {
  const alerts: SecurityAlert[] = [];
  const bfIp = await bruteForceIps();
  for (const x of bfIp) {
    alerts.push({
      id: `bf-ip-${x.ip}`,
      severity: "high",
      reason: "Repeated failed sign-in attempts from IP",
      timestamp: new Date().toISOString(),
      relatedUserId: null,
      relatedIp: x.ip,
      evidence: { failures: x.failures, windowMinutes: x.windowMin },
    });
  }

  const bfId = await bruteForceIdentifiers();
  for (const x of bfId) {
    alerts.push({
      id: `bf-id-${x.identifier}`,
      severity: "high",
      reason: "Repeated failed sign-in attempts for identifier",
      timestamp: new Date().toISOString(),
      relatedUserId: null,
      relatedIp: null,
      evidence: { failures: x.failures, windowMinutes: x.windowMin, identifier: x.identifier },
    });
  }

  const devices = await manyDevicesUsers();
  for (const x of devices) {
    alerts.push({
      id: `devices-${x.userId}`,
      severity: "medium",
      reason: "Many distinct devices in a short period",
      timestamp: new Date().toISOString(),
      relatedUserId: x.userId,
      relatedIp: null,
      evidence: { distinctUserAgents: x.distinctAgents, windowHours: MANY_DEVICES_HOURS },
    });
  }

  const novel = await newLocationEvents();
  for (const x of novel) {
    alerts.push({
      id: `new-ip-${x.userId}-${x.ip}-${x.at.getTime()}`,
      severity: "low",
      reason: "First successful sign-in from this IP for account",
      timestamp: x.at.toISOString(),
      relatedUserId: x.userId,
      relatedIp: x.ip,
      evidence: {},
    });
  }

  alerts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return alerts;
}

export async function getSuspiciousContext(): Promise<{
  ips: Set<string>;
  identifiers: Set<string>;
  userIds: Set<string>;
}> {
  const alerts = await getSecurityAlerts();
  const ips = new Set<string>();
  const identifiers = new Set<string>();
  const userIds = new Set<string>();
  for (const a of alerts) {
    if (a.relatedIp) ips.add(a.relatedIp);
    if (a.relatedUserId) userIds.add(a.relatedUserId);
    const id = a.evidence.identifier;
    if (typeof id === "string" && id.length > 0) identifiers.add(id);
  }
  const bfId = await bruteForceIdentifiers();
  for (const x of bfId) identifiers.add(x.identifier);
  const bfIp = await bruteForceIps();
  for (const x of bfIp) ips.add(x.ip);
  return { ips, identifiers, userIds };
}

export async function getHighRiskUsers(limit: number): Promise<HighRiskUser[]> {
  const db = getDb();
  const since24h = sql`now() - interval '24 hours'`;

  const failedByUser = db
    .select({
      userId: authLoginEvents.userId,
      failedCount: count().as("failed_count"),
    })
    .from(authLoginEvents)
    .where(
      and(
        eq(authLoginEvents.outcome, "failed"),
        isNotNull(authLoginEvents.userId),
        gte(authLoginEvents.createdAt, since24h)
      )
    )
    .groupBy(authLoginEvents.userId)
    .as("failed_by_user");

  const ipByUser = db
    .select({
      userId: authLoginEvents.userId,
      ipCount: sql<number>`count(distinct ${authLoginEvents.ipHint})`
        .mapWith(Number)
        .as("ip_count"),
    })
    .from(authLoginEvents)
    .where(
      and(
        isNotNull(authLoginEvents.userId),
        isNotNull(authLoginEvents.ipHint),
        gte(authLoginEvents.createdAt, since24h)
      )
    )
    .groupBy(authLoginEvents.userId)
    .as("ip_by_user");

  const rows = await db
    .select({
      id: users.id,
      localPart: users.localPart,
      fullName: users.fullName,
      isSuspended: users.isSuspended,
      securityLockedUntil: users.securityLockedUntil,
      failed: sql<number>`coalesce(${failedByUser.failedCount}, 0)`.mapWith(
        Number
      ),
      distinctIps: sql<number>`coalesce(${ipByUser.ipCount}, 0)`.mapWith(
        Number
      ),
    })
    .from(users)
    .leftJoin(failedByUser, eq(users.id, failedByUser.userId))
    .leftJoin(ipByUser, eq(users.id, ipByUser.userId))
    .where(
      or(
        sql`coalesce(${failedByUser.failedCount}, 0) > 0`,
        sql`coalesce(${ipByUser.ipCount}, 0) >= 3`
      )
    )
    .orderBy(
      desc(
        sql`coalesce(${failedByUser.failedCount}, 0) * 3 + coalesce(${ipByUser.ipCount}, 0)`
      )
    )
    .limit(limit);

  const alertUsers = new Set((await getSecurityAlerts()).map((a) => a.relatedUserId).filter(Boolean) as string[]);

  const out: HighRiskUser[] = [];
  for (const r of rows) {
    const failedW = Math.min(r.failed, 20);
    const ipW = Math.min(r.distinctIps, 10);
    const alertBonus = alertUsers.has(r.id) ? 15 : 0;
    const suspendedBonus = r.isSuspended ? 5 : 0;
    const score = failedW * 3 + ipW * 2 + alertBonus + suspendedBonus;
    out.push({
      user: {
        id: r.id,
        email: `${r.localPart}@sendora.com`,
        fullName: r.fullName,
        isSuspended: r.isSuspended,
        securityLockedUntil: r.securityLockedUntil?.toISOString() ?? null,
      },
      score,
      breakdown: {
        failedLogins24h: r.failed,
        distinctIps24h: r.distinctIps,
        openAlertBonus: alertBonus,
        suspendedBonus,
      },
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

export type LoginEventRow = {
  id: string;
  outcome: string;
  authMethod: string;
  context: string;
  userId: string | null;
  identifier: string;
  failureCode: string | null;
  ipHint: string | null;
  userAgent: string | null;
  geoCountry: string | null;
  geoCity: string | null;
  createdAt: string;
};

export async function listLoginEvents(input: {
  page: number;
  pageSize: number;
  q?: string;
  ip?: string;
  device?: string;
  outcome?: "success" | "failed";
  dateFrom?: string;
  dateTo?: string;
  suspiciousOnly?: boolean;
  highRiskOnly?: boolean;
}): Promise<{ rows: LoginEventRow[]; total: number }> {
  const db = getDb();
  const pageSize = Math.min(100, Math.max(1, input.pageSize));
  const page = Math.max(1, input.page);
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (input.outcome) {
    conditions.push(eq(authLoginEvents.outcome, input.outcome));
  }
  if (input.ip?.trim()) {
    conditions.push(eq(authLoginEvents.ipHint, input.ip.trim()));
  }
  if (input.device?.trim()) {
    conditions.push(
      sql`${authLoginEvents.userAgent} ILIKE ${"%" + input.device.trim() + "%"}`
    );
  }
  if (input.q?.trim()) {
    const term = "%" + input.q.trim().toLowerCase() + "%";
    conditions.push(
      or(
        sql`lower(${authLoginEvents.identifier}) like ${term}`,
        sql`exists (
          select 1 from ${users} u
          where u.id = ${authLoginEvents.userId}
          and lower(u.local_part || '@sendora.com') like ${term}
        )`
      )
    );
  }
  if (input.dateFrom) {
    const d = new Date(input.dateFrom);
    if (!Number.isNaN(d.getTime())) {
      conditions.push(gte(authLoginEvents.createdAt, d));
    }
  }
  if (input.dateTo) {
    const d = new Date(input.dateTo);
    if (!Number.isNaN(d.getTime())) {
      conditions.push(lte(authLoginEvents.createdAt, d));
    }
  }

  if (input.suspiciousOnly) {
    const ctx = await getSuspiciousContext();
    const ors = [];
    if (ctx.ips.size > 0) {
      ors.push(inArray(authLoginEvents.ipHint, [...ctx.ips]));
    }
    if (ctx.identifiers.size > 0) {
      ors.push(inArray(authLoginEvents.identifier, [...ctx.identifiers]));
    }
    if (ctx.userIds.size > 0) {
      ors.push(inArray(authLoginEvents.userId, [...ctx.userIds]));
    }
    if (ors.length === 0) {
      return { rows: [], total: 0 };
    }
    conditions.push(or(...ors)!);
  }

  if (input.highRiskOnly) {
    const hr = await getHighRiskUsers(500);
    const ids = hr.map((h) => h.user.id);
    if (ids.length === 0) {
      return { rows: [], total: 0 };
    }
    conditions.push(inArray(authLoginEvents.userId, ids));
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;

  const [countRow] = await db
    .select({ n: count() })
    .from(authLoginEvents)
    .where(whereClause);

  const total = Number(countRow?.n ?? 0);

  const rows = await db
    .select({
      id: authLoginEvents.id,
      outcome: authLoginEvents.outcome,
      authMethod: authLoginEvents.authMethod,
      context: authLoginEvents.context,
      userId: authLoginEvents.userId,
      identifier: authLoginEvents.identifier,
      failureCode: authLoginEvents.failureCode,
      ipHint: authLoginEvents.ipHint,
      userAgent: authLoginEvents.userAgent,
      geoCountry: authLoginEvents.geoCountry,
      geoCity: authLoginEvents.geoCity,
      createdAt: authLoginEvents.createdAt,
    })
    .from(authLoginEvents)
    .where(whereClause)
    .orderBy(desc(authLoginEvents.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    total,
    rows: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export type ActiveSessionRow = {
  sessionId: string;
  userId: string;
  email: string;
  userAgent: string | null;
  ipHint: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string;
};

export async function listActiveSessions(input: {
  page: number;
  pageSize: number;
  q?: string;
}): Promise<{ rows: ActiveSessionRow[]; total: number }> {
  const db = getDb();
  const pageSize = Math.min(100, Math.max(1, input.pageSize));
  const page = Math.max(1, input.page);
  const offset = (page - 1) * pageSize;

  const conditions = [gte(sessions.expiresAt, sql`now()`)];

  if (input.q?.trim()) {
    const term = "%" + input.q.trim().toLowerCase() + "%";
    conditions.push(
      or(
        sql`lower(${users.localPart} || '@sendora.com') like ${term}`,
        sql`lower(coalesce(${users.fullName}, '')) like ${term}`
      )!
    );
  }

  const whereClause = and(...conditions);

  const [countRow] = await db
    .select({ n: count() })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(whereClause);

  const total = Number(countRow?.n ?? 0);

  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      localPart: users.localPart,
      userAgent: sessions.userAgent,
      ipHint: sessions.ipHint,
      lastUsedAt: sessions.lastUsedAt,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(whereClause)
    .orderBy(desc(sessions.lastUsedAt), desc(sessions.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    total,
    rows: rows.map((r) => ({
      sessionId: r.sessionId,
      userId: r.userId,
      email: `${r.localPart}@sendora.com`,
      userAgent: r.userAgent,
      ipHint: r.ipHint,
      lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
    })),
  };
}
