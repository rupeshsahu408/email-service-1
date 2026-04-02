"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DashboardData = {
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
    /** Added in API v2 — optional for older cached responses */
    mailboxCount?: number;
    domainCount?: number;
    recentErrors24h?: number;
    emailDeliveryFailuresToday?: number;
    inboundEmailFailuresToday?: number;
    totalRevenue?: number;
    todayRevenueUtc?: number;
    thisMonthRevenueUtc?: number;
    businessEmailRevenue?: number;
    temporaryInboxRevenue?: number;
    totalPaidUsers?: number;
    failedPayments?: number;
  };
  charts: {
    emailVolumeLast7Days: Array<{ label: string; sent: number; received: number }>;
    userGrowthLast7Days: Array<{ label: string; users: number }>;
  };
  storage: {
    totalCapacityBytes: number;
    totalUsedBytes: number;
    totalFreeBytes: number;
    usagePercent: number;
    warningState: "ok" | "warning80" | "warning95" | "full";
    breakdown: {
      inboxBytes: number;
      sentBytes: number;
      trashBytes: number;
      attachmentBytes: number;
    };
    topUsers: Array<{
      userId: string;
      email: string;
      usedBytes: number;
    }>;
  };
  recentActivity: Array<{
    id: string;
    title: string;
    detail: string;
    createdAt: string;
    severity: "info" | "warning" | "error" | "success";
  }>;
  alerts: Array<{ id: string; title: string; detail: string; severity: "info" | "warning" | "error" }>;
  systemStatus: Array<{
    name: "API Server" | "Mail Server" | "Queue" | "Database" | "Storage";
    status: "healthy" | "degraded" | "down";
    latencyMs: number;
    message: string;
  }>;
};

type StatCard = { label: string; value: string; delta?: string; tone?: "default" | "good" | "warn" | "danger" };

function toneClasses(tone: StatCard["tone"]) {
  if (tone === "good") return "text-emerald-700 bg-emerald-50 border-emerald-100";
  if (tone === "warn") return "text-amber-700 bg-amber-50 border-amber-100";
  if (tone === "danger") return "text-red-700 bg-red-50 border-red-100";
  return "text-[var(--accent)] bg-[var(--accent-soft)] border-[var(--border)]";
}

function badgeClasses(status: "success" | "warning" | "error" | "info") {
  if (status === "success") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "warning") return "bg-amber-50 text-amber-700 border-amber-100";
  if (status === "error") return "bg-red-50 text-red-700 border-red-100";
  return "bg-blue-50 text-blue-700 border-blue-100";
}

function statusDot(status: "healthy" | "degraded" | "down") {
  if (status === "healthy") return "bg-emerald-500";
  if (status === "degraded") return "bg-amber-500";
  return "bg-red-500";
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

type CleanupAction = "empty_all_trash" | "delete_deleted_messages" | "clean_old_sent";

export function AdminDashboard() {
  const [now, setNow] = useState<Date>(new Date());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(30);
  const [cleanupError, setCleanupError] = useState("");
  const [cleanupConfirmText, setCleanupConfirmText] = useState("");
  const [cleanupConfirm, setCleanupConfirm] = useState<{
    action: CleanupAction;
    title: string;
    detail: string;
    affectedUsers: number;
    affectedMessages: number;
    estimatedRecoverableBytes: number;
  } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadDashboard() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/dashboard", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        detail?: string;
        data?: DashboardData;
      };
      if (res.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!res.ok || !json.ok || !json.data) {
        const msg = json.error ?? "Could not load dashboard data.";
        setError(json.detail ? `${msg} (${json.detail})` : msg);
        setData(null);
        return;
      }
      setData(json.data);
    } catch {
      setError("Network error while loading dashboard.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const sentMax = useMemo(
    () =>
      Math.max(
        1,
        ...(data?.charts.emailVolumeLast7Days.map((d) => Math.max(d.sent, d.received)) ?? [1])
      ),
    [data]
  );
  const userMax = useMemo(
    () => Math.max(1, ...(data?.charts.userGrowthLast7Days.map((d) => d.users) ?? [1])),
    [data]
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }

  async function previewCleanup(action: CleanupAction) {
    setCleanupError("");
    setCleanupLoading(true);
    try {
      const params = new URLSearchParams({ action });
      if (action === "clean_old_sent") params.set("days", String(cleanupDays));
      const res = await fetch(`/api/admin/storage/cleanup?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        preview?: {
          action: CleanupAction;
          affectedUsers: number;
          affectedMessages: number;
          estimatedRecoverableBytes: number;
        };
      };
      if (!res.ok || !json.ok || !json.preview) {
        setCleanupError(json.error ?? "Unable to generate cleanup preview.");
        return;
      }
      const titleMap: Record<CleanupAction, string> = {
        empty_all_trash: "Empty all users' trash?",
        delete_deleted_messages: "Delete all messages for deleted users?",
        clean_old_sent: `Delete sent messages older than ${cleanupDays} day(s)?`,
      };
      setCleanupConfirm({
        action,
        title: titleMap[action],
        detail:
          "This action permanently deletes data. Type-safe confirmation is required and this action is logged.",
        affectedUsers: json.preview.affectedUsers,
        affectedMessages: json.preview.affectedMessages,
        estimatedRecoverableBytes: json.preview.estimatedRecoverableBytes,
      });
      setCleanupConfirmText("");
    } catch {
      setCleanupError("Network error while preparing cleanup preview.");
    } finally {
      setCleanupLoading(false);
    }
  }

  async function executeCleanup(action: CleanupAction) {
    setCleanupError("");
    setCleanupLoading(true);
    try {
      const res = await fetch("/api/admin/storage/cleanup", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          days: action === "clean_old_sent" ? cleanupDays : undefined,
          confirmText: cleanupConfirmText.trim(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setCleanupError(json.error ?? "Cleanup action failed.");
        return;
      }
      setCleanupConfirm(null);
      await loadDashboard();
    } catch {
      setCleanupError("Network error while running cleanup.");
    } finally {
      setCleanupLoading(false);
    }
  }

  const stats: StatCard[] = data
    ? [
        { label: "Total Users", value: data.summary.totalUsers.toLocaleString() },
        { label: "Active Users", value: data.summary.activeUsers.toLocaleString(), tone: "good" },
        {
          label: "Total Revenue",
          value: `INR ${((data.summary.totalRevenue ?? 0) / 100).toLocaleString()}`,
          tone: "good",
        },
        {
          label: "Today Revenue (UTC)",
          value: `INR ${((data.summary.todayRevenueUtc ?? 0) / 100).toLocaleString()}`,
          tone: "good",
        },
        {
          label: "This Month Revenue (UTC)",
          value: `INR ${((data.summary.thisMonthRevenueUtc ?? 0) / 100).toLocaleString()}`,
          tone: "good",
        },
        {
          label: "Business Email Revenue",
          value: `INR ${((data.summary.businessEmailRevenue ?? 0) / 100).toLocaleString()}`,
        },
        {
          label: "Temporary Inbox Revenue",
          value: `INR ${((data.summary.temporaryInboxRevenue ?? 0) / 100).toLocaleString()}`,
        },
        {
          label: "Total Paid Users",
          value: (data.summary.totalPaidUsers ?? 0).toLocaleString(),
          tone: "good",
        },
        {
          label: "Failed Payments",
          value: (data.summary.failedPayments ?? 0).toLocaleString(),
          tone: (data.summary.failedPayments ?? 0) > 0 ? "warn" : "good",
        },
        {
          label: "Mailboxes (domains)",
          value: `${(data.summary.mailboxCount ?? 0).toLocaleString()} / ${(data.summary.domainCount ?? 0).toLocaleString()}`,
          tone: "default",
        },
        { label: "Emails Sent Today (UTC)", value: data.summary.emailsSentToday.toLocaleString() },
        { label: "Emails Received Today (UTC)", value: data.summary.emailsReceivedToday.toLocaleString() },
        { label: "Delivery Rate", value: `${data.summary.deliveryRate.toFixed(1)}%`, tone: "good" },
        {
          label: "Bounce Rate",
          value: `${data.summary.bounceRate.toFixed(1)}%`,
          tone: data.summary.bounceRate >= 5 ? "warn" : "good",
        },
        {
          label: "Outbound send failures (UTC)",
          value: (data.summary.emailDeliveryFailuresToday ?? 0).toLocaleString(),
          tone: (data.summary.emailDeliveryFailuresToday ?? 0) > 0 ? "warn" : "good",
        },
        {
          label: "Inbound save failures (UTC)",
          value: (data.summary.inboundEmailFailuresToday ?? 0).toLocaleString(),
          tone: (data.summary.inboundEmailFailuresToday ?? 0) > 0 ? "danger" : "good",
        },
        {
          label: "Admin log errors/warnings (24h)",
          value: (data.summary.recentErrors24h ?? 0).toLocaleString(),
          tone: (data.summary.recentErrors24h ?? 0) > 0 ? "warn" : "good",
        },
        {
          label: "Suspended Accounts",
          value: data.summary.suspendedAccounts.toLocaleString(),
          tone: data.summary.suspendedAccounts > 0 ? "warn" : "default",
        },
        {
          label: "System Health",
          value: data.summary.systemHealth[0].toUpperCase() + data.summary.systemHealth.slice(1),
          tone:
            data.summary.systemHealth === "healthy"
              ? "good"
              : data.summary.systemHealth === "degraded"
                ? "warn"
                : "danger",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm shadow-[2px_4px_28px_-14px_rgba(28,27,51,0.1)] ring-1 ring-black/[0.03] dark:ring-white/[0.05] md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Admin Dashboard</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Live data from your database. Daily email totals and charts use UTC dates so they stay aligned with server-stored messages.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] px-3 py-2 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Current Time</p>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {now.toLocaleDateString()} {now.toLocaleTimeString()}
              </p>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--accent)] shadow-sm transition-[colors,transform] hover:border-[var(--accent)]/35 hover:bg-[var(--accent-soft)] active:scale-[0.98] disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-10 text-sm text-[var(--muted)] shadow-sm">
          <svg
            className="h-6 w-6 animate-spin text-[var(--accent)]"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeOpacity="0.2"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <p className="font-medium">Loading dashboard data…</p>
        </section>
      ) : null}

      {!loading && error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {error}
        </section>
      ) : null}

      {!loading && !error && !data ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted)] shadow-sm">
          No dashboard data available yet.
        </section>
      ) : null}

      {!loading && !error && data ? (
      <>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <article
            key={s.label}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{s.label}</p>
            <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{s.value}</p>
            {s.delta ? (
              <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses(s.tone)}`}>
                {s.delta}
              </span>
            ) : null}
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm xl:col-span-2 md:p-6">
          <h3 className="text-base font-semibold text-[var(--foreground)]">Storage Monitoring</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Aggregated live usage across all users and storage contributors.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Total capacity</p>
              <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{formatBytes(data.storage.totalCapacityBytes)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Total used</p>
              <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{formatBytes(data.storage.totalUsedBytes)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Total free</p>
              <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{formatBytes(data.storage.totalFreeBytes)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Usage</p>
              <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{data.storage.usagePercent.toFixed(1)}%</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="h-3 overflow-hidden rounded-full bg-[var(--accent-soft)]">
              <div
                className={`h-3 rounded-full ${
                  data.storage.warningState === "full"
                    ? "bg-red-600"
                    : data.storage.warningState === "warning95"
                      ? "bg-amber-500"
                      : data.storage.warningState === "warning80"
                        ? "bg-yellow-500"
                        : "bg-[var(--accent)]"
                }`}
                style={{ width: `${Math.min(100, data.storage.usagePercent)}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-[var(--muted)]">
              {data.storage.warningState === "full"
                ? "Storage is at or above capacity."
                : data.storage.warningState === "warning95"
                  ? "Storage is nearing critical capacity."
                  : data.storage.warningState === "warning80"
                    ? "Storage is above recommended threshold."
                    : "Storage usage is within normal range."}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-[var(--foreground)] sm:grid-cols-4">
            <p>Inbox: {formatBytes(data.storage.breakdown.inboxBytes)}</p>
            <p>Sent: {formatBytes(data.storage.breakdown.sentBytes)}</p>
            <p>Trash: {formatBytes(data.storage.breakdown.trashBytes)}</p>
            <p>Attachments: {formatBytes(data.storage.breakdown.attachmentBytes)}</p>
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm md:p-6">
          <h3 className="text-base font-semibold text-[var(--foreground)]">Top Storage Users</h3>
          <div className="mt-4 space-y-2.5">
            {data.storage.topUsers.map((u) => (
              <div key={u.userId} className="rounded-lg border border-[var(--border)] bg-[var(--accent-soft)] px-3 py-2">
                <p className="truncate text-sm font-semibold text-[var(--foreground)]">{u.email}</p>
                <p className="text-xs text-[var(--muted)]">{formatBytes(u.usedBytes)}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm md:p-6">
          <h3 className="text-base font-semibold text-[var(--foreground)]">Emails Sent vs Received (Last 7 Days)</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">Daily comparison of outbound and inbound volume.</p>
          <div className="mt-5 space-y-3">
            {data.charts.emailVolumeLast7Days.map((d) => (
              <div key={d.label}>
                <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
                  <span>{d.label}</span>
                  <span>
                    Sent {d.sent.toLocaleString()} / Received {d.received.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--background)]">
                  <div
                    className="h-3 rounded-full bg-[var(--accent)]"
                    style={{ width: `${(d.sent / sentMax) * 100}%` }}
                  />
                </div>
                <div className="-mt-2 h-3 overflow-hidden rounded-full">
                  <div
                    className="h-3 rounded-full bg-[var(--accent)]/55"
                    style={{ width: `${(d.received / sentMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-4 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[var(--accent)]" />Sent</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[var(--accent)]/55" />Received</span>
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm md:p-6">
          <h3 className="text-base font-semibold text-[var(--foreground)]">User Growth</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">Steady growth trend over the past 7 days.</p>
          <div className="mt-6 flex h-56 items-end justify-between gap-2">
            {data.charts.userGrowthLast7Days.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative flex h-44 w-full items-end">
                  <div
                    className="w-full rounded-t-xl bg-gradient-to-t from-[var(--accent)] to-[#a78bfa] shadow-sm transition hover:opacity-90"
                    style={{ height: `${(d.users / userMax) * 100}%` }}
                    title={`${d.users.toLocaleString()} users`}
                  />
                </div>
                <div className="text-xs font-semibold text-[var(--muted)]">{d.label}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm xl:col-span-2 md:p-6">
          <h3 className="text-base font-semibold text-[var(--foreground)]">Recent Activity</h3>
          <div className="mt-4 space-y-3">
            {data.recentActivity.length === 0 ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--muted)]">
                No recent activity recorded yet.
              </p>
            ) : data.recentActivity.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3 transition hover:bg-[var(--card)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{row.title}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{row.detail}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${badgeClasses(row.severity)}`}>
                    {row.severity}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-[var(--muted)]">{new Date(row.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm md:p-6">
          <h3 className="text-base font-semibold text-[var(--foreground)]">Alerts</h3>
          <div className="mt-4 space-y-3">
            {data.alerts.length === 0 ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] px-3.5 py-3 text-sm text-[var(--muted)]">
                No alerts right now.
              </p>
            ) : data.alerts.map((a) => (
              <div key={a.id} className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] px-3.5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{a.title}</p>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeClasses(a.severity)}`}>
                    {a.severity}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-[var(--muted)]">{a.detail}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm lg:col-span-2 md:p-6">
          <h3 className="text-base font-semibold text-[var(--foreground)]">Global Cleanup Controls</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Run admin cleanup actions with preview + confirmation. Every action is audit logged.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="cleanup-days" className="font-medium text-[var(--foreground)]">
              Sent message age (days):
            </label>
            <input
              id="cleanup-days"
              type="number"
              min={1}
              max={3650}
              value={cleanupDays}
              onChange={(e) => setCleanupDays(Math.max(1, Number(e.target.value || 30)))}
              className="w-28 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-sm text-[var(--foreground)]"
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={cleanupLoading}
              onClick={() => void previewCleanup("empty_all_trash")}
              className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card)] disabled:opacity-60"
            >
              Empty all trash
            </button>
            <button
              type="button"
              disabled={cleanupLoading}
              onClick={() => void previewCleanup("delete_deleted_messages")}
              className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card)] disabled:opacity-60"
            >
              Delete deleted-user messages
            </button>
            <button
              type="button"
              disabled={cleanupLoading}
              onClick={() => void previewCleanup("clean_old_sent")}
              className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card)] disabled:opacity-60"
            >
              Clean old sent
            </button>
          </div>
          {cleanupError ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {cleanupError}
            </p>
          ) : null}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Users", href: "/admin/users" },
              { label: "Domains", href: "/admin/domains" },
              { label: "Security", href: "/admin/security" },
              { label: "Dashboard", href: "/admin/dashboard" },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3 text-center text-sm font-semibold text-[var(--foreground)] transition hover:-translate-y-0.5 hover:bg-[var(--card)] hover:shadow-sm"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm md:p-6">
          <h3 className="text-base font-semibold text-[var(--foreground)]">System Status</h3>
          <div className="mt-4 space-y-2.5">
            {data.systemStatus.map((s) => (
              <div key={s.name} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--accent-soft)] px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusDot(s.status)}`} />
                  <span className="text-sm text-[var(--foreground)]">{s.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{s.status}</p>
                  <p className="text-[11px] text-[var(--muted)]">{s.latencyMs ? `${s.latencyMs}ms` : s.message}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
      </>
      ) : null}

      {cleanupConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl bg-[var(--card)] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">{cleanupConfirm.title}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{cleanupConfirm.detail}</p>
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] p-3 text-sm text-[var(--foreground)]">
              <p>Affected users: {cleanupConfirm.affectedUsers.toLocaleString()}</p>
              <p>Affected messages: {cleanupConfirm.affectedMessages.toLocaleString()}</p>
              <p>Estimated recoverable: {formatBytes(cleanupConfirm.estimatedRecoverableBytes)}</p>
            </div>
            <div className="mt-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Type CONFIRM to continue
              </label>
              <input
                value={cleanupConfirmText}
                onChange={(e) => setCleanupConfirmText(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]"
                placeholder="CONFIRM"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCleanupConfirm(null)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--background)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={cleanupLoading || cleanupConfirmText.trim().toUpperCase() !== "CONFIRM"}
                onClick={() => void executeCleanup(cleanupConfirm.action)}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {cleanupLoading ? "Running..." : "Confirm Cleanup"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
