import { and, count, desc, eq, gte, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  adminActivityLogs,
  attachments,
  domains,
  mailboxes,
  messages,
  scheduledEmails,
  sessions,
  users,
} from "@/db/schema";
import { ensureAdminActivityTable } from "./admin-activity";
import { getBillingMetricsUtc } from "./billing";

/** Start of UTC calendar day (stable chart boundaries across timezones). */
function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export type AdminDashboardData = {
  generatedAt: string;
  summary: {
    totalUsers: number;
    activeUsers: number;
    emailsSentToday: number;
    emailsReceivedToday: number;
    deliveryRate: number;
    bounceRate: number;
    suspendedAccounts: number;
    systemHealth: "healthy" | "degraded" | "down";
    /** Verified business mail infra */
    mailboxCount: number;
    domainCount: number;
    /** admin_activity_logs severity warning/error in last 24h */
    recentErrors24h: number;
    /** Logged outbound send failures today (UTC day) */
    emailDeliveryFailuresToday: number;
    /** Logged inbound ingest failures today (UTC day) */
    inboundEmailFailuresToday: number;
    totalRevenue: number;
    todayRevenueUtc: number;
    thisMonthRevenueUtc: number;
    businessEmailRevenue: number;
    temporaryInboxRevenue: number;
    totalPaidUsers: number;
    failedPayments: number;
  };
  charts: {
    emailVolumeLast7Days: Array<{ label: string; sent: number; received: number }>;
    userGrowthLast7Days: Array<{ label: string; users: number }>;
  };
  recentActivity: Array<{
    id: string;
    title: string;
    detail: string;
    createdAt: string;
    severity: "info" | "warning" | "error" | "success";
  }>;
  alerts: Array<{
    id: string;
    title: string;
    detail: string;
    severity: "info" | "warning" | "error";
  }>;
  systemStatus: Array<{
    name: "API Server" | "Mail Server" | "Queue" | "Database" | "Storage";
    status: "healthy" | "degraded" | "down";
    latencyMs: number;
    message: string;
  }>;
};

function toPercent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  await ensureAdminActivityTable();
  const db = getDb();
  const now = new Date();
  const todayUtc = utcDayStart(now);
  const sevenDaysAgoUtc = new Date(todayUtc.getTime() - 6 * 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const msgDayUtc = sql`(${messages.createdAt} AT TIME ZONE 'UTC')::date`;
  const userDayUtc = sql`(${users.createdAt} AT TIME ZONE 'UTC')::date`;

  const [
    totalUsersRow,
    activeUsersRows,
    sentTodayRow,
    recvTodayRow,
    suspendedRow,
    sentRows7d,
    recvRows7d,
    queueScheduledRow,
    storageAttachmentCountRow,
    mailboxCountRow,
    domainCountRow,
    recentErrors24hRow,
    inboundFailuresTodayRow,
  ] = await Promise.all([
    db.select({ c: count() }).from(users),
    db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(sql`${sessions.expiresAt} > now()`)
      .groupBy(sessions.userId),
    db
      .select({ c: count() })
      .from(messages)
      .where(and(eq(messages.folder, "sent"), gte(messages.createdAt, todayUtc))),
    db
      .select({ c: count() })
      .from(messages)
      .where(and(eq(messages.folder, "inbox"), gte(messages.createdAt, todayUtc))),
    db.select({ c: count() }).from(users).where(eq(users.isSuspended, true)),
    db
      .select({
        label: sql<string>`to_char(${msgDayUtc}, 'Dy')`,
        day: sql<string>`to_char(${msgDayUtc}, 'YYYY-MM-DD')`,
        c: count(),
      })
      .from(messages)
      .where(and(eq(messages.folder, "sent"), gte(messages.createdAt, sevenDaysAgoUtc)))
      .groupBy(msgDayUtc)
      .orderBy(msgDayUtc),
    db
      .select({
        label: sql<string>`to_char(${msgDayUtc}, 'Dy')`,
        day: sql<string>`to_char(${msgDayUtc}, 'YYYY-MM-DD')`,
        c: count(),
      })
      .from(messages)
      .where(and(eq(messages.folder, "inbox"), gte(messages.createdAt, sevenDaysAgoUtc)))
      .groupBy(msgDayUtc)
      .orderBy(msgDayUtc),
    db
      .select({ c: count() })
      .from(scheduledEmails)
      .where(eq(scheduledEmails.status, "scheduled")),
    db.select({ c: count() }).from(attachments),
    db.select({ c: count() }).from(mailboxes),
    db.select({ c: count() }).from(domains),
    db
      .select({ c: count() })
      .from(adminActivityLogs)
      .where(
        and(
          gte(adminActivityLogs.createdAt, twentyFourHoursAgo),
          or(
            eq(adminActivityLogs.severity, "error"),
            eq(adminActivityLogs.severity, "warning")
          )
        )
      ),
    db
      .select({ c: count() })
      .from(adminActivityLogs)
      .where(
        and(
          eq(adminActivityLogs.eventType, "inbound_email_failure"),
          gte(adminActivityLogs.createdAt, todayUtc)
        )
      ),
  ]);
  const billingMetrics = await getBillingMetricsUtc(now);

  let recentActivityRows: typeof adminActivityLogs.$inferSelect[] = [];
  let failedAdminLoginsHour = 0;
  try {
    const [recentRows, failedRows] = await Promise.all([
      db
        .select()
        .from(adminActivityLogs)
        .orderBy(desc(adminActivityLogs.createdAt))
        .limit(12),
      db
        .select({ c: count() })
        .from(adminActivityLogs)
        .where(
          and(
            eq(adminActivityLogs.eventType, "admin_login_failed"),
            gte(adminActivityLogs.createdAt, oneHourAgo)
          )
        ),
    ]);
    recentActivityRows = recentRows;
    failedAdminLoginsHour = failedRows[0]?.c ?? 0;
  } catch {
    recentActivityRows = [];
    failedAdminLoginsHour = 0;
  }

  const totalUsers = totalUsersRow[0]?.c ?? 0;
  const activeUsers = activeUsersRows.length;
  const emailsSentToday = sentTodayRow[0]?.c ?? 0;
  const emailsReceivedToday = recvTodayRow[0]?.c ?? 0;
  const suspendedAccounts = suspendedRow[0]?.c ?? 0;
  let bounceEventsToday = 0;
  try {
    const bounceRows = await db
      .select({ c: count() })
      .from(adminActivityLogs)
      .where(
        and(
          eq(adminActivityLogs.eventType, "email_delivery_failure"),
          gte(adminActivityLogs.createdAt, todayUtc)
        )
      );
    bounceEventsToday = bounceRows[0]?.c ?? 0;
  } catch {
    bounceEventsToday = 0;
  }

  const deliveryRate = toPercent(emailsSentToday - bounceEventsToday, Math.max(emailsSentToday, 1));
  const bounceRate = toPercent(bounceEventsToday, Math.max(emailsSentToday, 1));

  const sentMap = new Map<string, number>();
  const recvMap = new Map<string, number>();
  for (const r of sentRows7d) sentMap.set(r.day, Number(r.c ?? 0));
  for (const r of recvRows7d) recvMap.set(r.day, Number(r.c ?? 0));

  const growthMap = new Map<string, number>();
  let cumulativeUsers = 0;
  try {
    const [userRows7d, cumulativeBeforeRows] = await Promise.all([
      db
        .select({
          day: sql<string>`to_char(${userDayUtc}, 'YYYY-MM-DD')`,
          c: count(),
        })
        .from(users)
        .where(gte(users.createdAt, sevenDaysAgoUtc))
        .groupBy(userDayUtc)
        .orderBy(userDayUtc),
      db
        .select({ c: count() })
        .from(users)
        .where(lt(users.createdAt, sevenDaysAgoUtc)),
    ]);
    for (const r of userRows7d) growthMap.set(r.day, Number(r.c ?? 0));
    cumulativeUsers = cumulativeBeforeRows[0]?.c ?? 0;
  } catch (err) {
    // If created_at is unavailable/mismatched in a legacy DB, keep dashboard usable.
    console.warn(
      "[admin/dashboard] user growth query fallback:",
      err instanceof Error ? err.message : String(err)
    );
    cumulativeUsers = totalUsers;
  }

  const emailVolumeLast7Days: AdminDashboardData["charts"]["emailVolumeLast7Days"] = [];
  const userGrowthLast7Days: AdminDashboardData["charts"]["userGrowthLast7Days"] = [];
  for (let i = 0; i < 7; i++) {
    const dayMs = sevenDaysAgoUtc.getTime() + i * 24 * 60 * 60 * 1000;
    const key = new Date(dayMs).toISOString().slice(0, 10);
    const label = new Date(key + "T12:00:00.000Z").toLocaleDateString(undefined, {
      weekday: "short",
      timeZone: "UTC",
    });
    const sent = sentMap.get(key) ?? 0;
    const received = recvMap.get(key) ?? 0;
    emailVolumeLast7Days.push({ label, sent, received });
    cumulativeUsers += growthMap.get(key) ?? 0;
    userGrowthLast7Days.push({ label, users: cumulativeUsers });
  }

  const dbStart = Date.now();
  let dbStatus: AdminDashboardData["systemStatus"][number] = {
    name: "Database",
    status: "healthy",
    latencyMs: 0,
    message: "Connected",
  };
  try {
    await db.select({ x: sql<number>`1` }).from(sql`(select 1) as t`).limit(1);
    const ms = Date.now() - dbStart;
    dbStatus = {
      name: "Database",
      status: ms > 400 ? "degraded" : "healthy",
      latencyMs: ms,
      message: ms > 400 ? "High latency" : "Connected",
    };
  } catch {
    dbStatus = { name: "Database", status: "down", latencyMs: 0, message: "Unreachable" };
  }

  const queueScheduled = queueScheduledRow[0]?.c ?? 0;
  const storageAttachmentCount = storageAttachmentCountRow[0]?.c ?? 0;
  const mailboxCount = Number(mailboxCountRow[0]?.c ?? 0);
  const domainCount = Number(domainCountRow[0]?.c ?? 0);
  const recentErrors24h = Number(recentErrors24hRow[0]?.c ?? 0);
  const inboundEmailFailuresToday = Number(inboundFailuresTodayRow[0]?.c ?? 0);

  const resendConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const mailIssues =
    !resendConfigured ||
    bounceEventsToday > 0 ||
    inboundEmailFailuresToday > 0;
  const hasAttachmentBackend =
    Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()) ||
    Boolean(process.env.S3_BUCKET?.trim()) ||
    Boolean(process.env.CLOUDINARY_CLOUD_NAME?.trim());

  const systemStatus: AdminDashboardData["systemStatus"] = [
    {
      name: "API Server",
      status: "healthy",
      latencyMs: 5,
      message: `Uptime ${Math.floor(process.uptime() / 60)}m`,
    },
    {
      name: "Mail Server",
      status: mailIssues ? "degraded" : "healthy",
      latencyMs: 0,
      message: !resendConfigured
        ? "API key missing"
        : bounceEventsToday > 0 || inboundEmailFailuresToday > 0
          ? `${bounceEventsToday} outbound + ${inboundEmailFailuresToday} inbound failures (UTC today)`
          : "Configured",
    },
    {
      name: "Queue",
      status: queueScheduled > 500 ? "degraded" : "healthy",
      latencyMs: 0,
      message: `${queueScheduled} scheduled jobs`,
    },
    dbStatus,
    {
      name: "Storage",
      status:
        hasAttachmentBackend
          ? storageAttachmentCount > 200000
            ? "degraded"
            : "healthy"
          : "degraded",
      latencyMs: 0,
      message: hasAttachmentBackend
        ? `${storageAttachmentCount} stored attachments`
        : "No blob/S3/Cloudinary config",
    },
  ];

  const overallHealth: AdminDashboardData["summary"]["systemHealth"] = systemStatus.some(
    (s) => s.status === "down"
  )
    ? "down"
    : systemStatus.some((s) => s.status === "degraded")
      ? "degraded"
      : "healthy";

  const alerts: AdminDashboardData["alerts"] = [];
  if (bounceRate >= 5) {
    alerts.push({
      id: "bounce-rate",
      title: "Bounce rate elevated",
      detail: `Bounce rate is ${bounceRate.toFixed(1)}% today.`,
      severity: bounceRate >= 10 ? "error" : "warning",
    });
  }
  if (failedAdminLoginsHour >= 10) {
    alerts.push({
      id: "failed-admin-logins",
      title: "Admin login failures spiking",
      detail: `${failedAdminLoginsHour} failed admin logins in the last hour.`,
      severity: failedAdminLoginsHour >= 20 ? "error" : "warning",
    });
  }
  if (suspendedAccounts > 0) {
    alerts.push({
      id: "suspended-accounts",
      title: "Suspended accounts present",
      detail: `${suspendedAccounts} suspended accounts currently flagged.`,
      severity: "info",
    });
  }
  if (inboundEmailFailuresToday > 0) {
    alerts.push({
      id: "inbound-failures",
      title: "Inbound email storage failures",
      detail: `${inboundEmailFailuresToday} inbound message(s) failed to persist today (UTC). Check DB schema and Resend webhook logs.`,
      severity: "error",
    });
  }
  if (recentErrors24h > 0) {
    alerts.push({
      id: "recent-errors",
      title: "Recent activity warnings/errors",
      detail: `${recentErrors24h} admin log entries with warning or error severity in the last 24 hours.`,
      severity: "warning",
    });
  }
  if (!resendConfigured) {
    alerts.push({
      id: "resend-missing",
      title: "Outbound email not configured",
      detail: "RESEND_API_KEY is not set. Users cannot send external mail.",
      severity: "error",
    });
  }
  if (overallHealth !== "healthy" && !alerts.some((a) => a.id === "system-degraded")) {
    alerts.push({
      id: "system-degraded",
      title: "System status degraded",
      detail:
        "One or more services below are not fully healthy. Review the System Status panel.",
      severity: "warning",
    });
  }
  if (overallHealth === "healthy" && alerts.length === 0) {
    alerts.push({
      id: "all-good",
      title: "No active alerts",
      detail: "All monitored dashboard rules are currently within thresholds.",
      severity: "info",
    });
  }

  const recentActivity: AdminDashboardData["recentActivity"] = recentActivityRows.map((r) => ({
    id: r.id,
    title: r.eventType.replace(/_/g, " "),
    detail: r.detail ?? "System event recorded.",
    createdAt: r.createdAt.toISOString(),
    severity:
      r.severity === "error" || r.severity === "warning" || r.severity === "success"
        ? r.severity
        : "info",
  }));

  return {
    generatedAt: now.toISOString(),
    summary: {
      totalUsers,
      activeUsers,
      emailsSentToday,
      emailsReceivedToday,
      deliveryRate,
      bounceRate,
      suspendedAccounts,
      systemHealth: overallHealth,
      mailboxCount,
      domainCount,
      recentErrors24h,
      emailDeliveryFailuresToday: bounceEventsToday,
      inboundEmailFailuresToday,
      totalRevenue: billingMetrics.totalRevenue,
      todayRevenueUtc: billingMetrics.todayRevenueUtc,
      thisMonthRevenueUtc: billingMetrics.thisMonthRevenueUtc,
      businessEmailRevenue: billingMetrics.businessEmailRevenue,
      temporaryInboxRevenue: billingMetrics.temporaryInboxRevenue,
      totalPaidUsers: billingMetrics.totalPaidUsers,
      failedPayments: billingMetrics.failedPayments,
    },
    charts: {
      emailVolumeLast7Days,
      userGrowthLast7Days,
    },
    recentActivity,
    alerts,
    systemStatus,
  };
}
