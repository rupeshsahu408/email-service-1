"use client";

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
  return "text-[#6d4aff] bg-[#f3efff] border-[#e7ddff]";
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

export function AdminDashboard() {
  const [now, setNow] = useState<Date>(new Date());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

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

  const stats: StatCard[] = data
    ? [
        { label: "Total Users", value: data.summary.totalUsers.toLocaleString() },
        { label: "Active Users", value: data.summary.activeUsers.toLocaleString(), tone: "good" },
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
      <section className="rounded-2xl border border-[#eae7f8] bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[#1c1b33]">Admin Dashboard</h2>
            <p className="mt-1 text-sm text-[#6f6b8c]">
              Live data from your database. Daily email totals and charts use UTC dates so they stay aligned with server-stored messages.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-[#ece9fb] bg-[#faf9ff] px-3 py-2 text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#8b86a8]">Current Time</p>
              <p className="text-sm font-semibold text-[#2a2740]">
                {now.toLocaleDateString()} {now.toLocaleTimeString()}
              </p>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-xl border border-[#e0daf9] bg-white px-3 py-2 text-sm font-medium text-[#4b3fa8] transition hover:bg-[#f6f2ff] disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="rounded-2xl border border-[#ece9fb] bg-white p-6 text-sm text-[#6f6b8c] shadow-sm">
          Loading dashboard data...
        </section>
      ) : null}

      {!loading && error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {error}
        </section>
      ) : null}

      {!loading && !error && !data ? (
        <section className="rounded-2xl border border-[#ece9fb] bg-white p-6 text-sm text-[#6f6b8c] shadow-sm">
          No dashboard data available yet.
        </section>
      ) : null}

      {!loading && !error && data ? (
      <>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <article
            key={s.label}
            className="rounded-2xl border border-[#ece9fb] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-[#8a85a7]">{s.label}</p>
            <p className="mt-2 text-2xl font-bold text-[#1c1b33]">{s.value}</p>
            {s.delta ? (
              <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses(s.tone)}`}>
                {s.delta}
              </span>
            ) : null}
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#ece9fb] bg-white p-5 shadow-sm md:p-6">
          <h3 className="text-base font-semibold text-[#1c1b33]">Emails Sent vs Received (Last 7 Days)</h3>
          <p className="mt-1 text-sm text-[#6f6b8c]">Daily comparison of outbound and inbound volume.</p>
          <div className="mt-5 space-y-3">
            {data.charts.emailVolumeLast7Days.map((d) => (
              <div key={d.label}>
                <div className="mb-1 flex items-center justify-between text-xs text-[#7b7697]">
                  <span>{d.label}</span>
                  <span>
                    Sent {d.sent.toLocaleString()} / Received {d.received.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#f2effc]">
                  <div
                    className="h-3 rounded-full bg-[#7a5cff]"
                    style={{ width: `${(d.sent / sentMax) * 100}%` }}
                  />
                </div>
                <div className="-mt-2 h-3 overflow-hidden rounded-full">
                  <div
                    className="h-3 rounded-full bg-[#c2b3ff]"
                    style={{ width: `${(d.received / sentMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-4 text-xs text-[#7b7697]">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#7a5cff]" />Sent</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#c2b3ff]" />Received</span>
          </div>
        </article>

        <article className="rounded-2xl border border-[#ece9fb] bg-white p-5 shadow-sm md:p-6">
          <h3 className="text-base font-semibold text-[#1c1b33]">User Growth</h3>
          <p className="mt-1 text-sm text-[#6f6b8c]">Steady growth trend over the past 7 days.</p>
          <div className="mt-6 flex h-56 items-end justify-between gap-2">
            {data.charts.userGrowthLast7Days.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative flex h-44 w-full items-end">
                  <div
                    className="w-full rounded-t-xl bg-gradient-to-t from-[#6d4aff] to-[#9f89ff] shadow-sm transition hover:opacity-90"
                    style={{ height: `${(d.users / userMax) * 100}%` }}
                    title={`${d.users.toLocaleString()} users`}
                  />
                </div>
                <div className="text-xs font-medium text-[#7b7697]">{d.label}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <article className="rounded-2xl border border-[#ece9fb] bg-white p-5 shadow-sm xl:col-span-2 md:p-6">
          <h3 className="text-base font-semibold text-[#1c1b33]">Recent Activity</h3>
          <div className="mt-4 space-y-3">
            {data.recentActivity.length === 0 ? (
              <p className="rounded-xl border border-[#f0edfb] bg-[#fcfbff] px-4 py-3 text-sm text-[#767290]">
                No recent activity recorded yet.
              </p>
            ) : data.recentActivity.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-[#f0edfb] bg-[#fcfbff] px-4 py-3 transition hover:bg-white"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#24213a]">{row.title}</p>
                    <p className="mt-1 text-xs text-[#767290]">{row.detail}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${badgeClasses(row.severity)}`}>
                    {row.severity}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-[#9a95b4]">{new Date(row.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-[#ece9fb] bg-white p-5 shadow-sm md:p-6">
          <h3 className="text-base font-semibold text-[#1c1b33]">Alerts</h3>
          <div className="mt-4 space-y-3">
            {data.alerts.length === 0 ? (
              <p className="rounded-xl border border-[#f0edfb] bg-[#fcfbff] px-3.5 py-3 text-sm text-[#767290]">
                No alerts right now.
              </p>
            ) : data.alerts.map((a) => (
              <div key={a.id} className="rounded-xl border border-[#f0edfb] bg-[#fcfbff] px-3.5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[#24213a]">{a.title}</p>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeClasses(a.severity)}`}>
                    {a.severity}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-[#767290]">{a.detail}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <article className="rounded-2xl border border-[#ece9fb] bg-white p-5 shadow-sm lg:col-span-2 md:p-6">
          <h3 className="text-base font-semibold text-[#1c1b33]">Quick Actions</h3>
          <p className="mt-1 text-sm text-[#6f6b8c]">Fast entry points for common admin operations.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {["Add User", "View Users", "Email Logs", "Domains", "Security", "Settings"].map((action) => (
              <button
                key={action}
                type="button"
                className="rounded-xl border border-[#e6e1fa] bg-[#faf8ff] px-4 py-3 text-sm font-semibold text-[#3e347f] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
              >
                {action}
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-[#ece9fb] bg-white p-5 shadow-sm md:p-6">
          <h3 className="text-base font-semibold text-[#1c1b33]">System Status</h3>
          <div className="mt-4 space-y-2.5">
            {data.systemStatus.map((s) => (
              <div key={s.name} className="flex items-center justify-between rounded-lg border border-[#f1eefb] bg-[#fcfbff] px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusDot(s.status)}`} />
                  <span className="text-sm text-[#2a2740]">{s.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#7b7697]">{s.status}</p>
                  <p className="text-[11px] text-[#9a95b4]">{s.latencyMs ? `${s.latencyMs}ms` : s.message}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
      </>
      ) : null}
    </div>
  );
}
