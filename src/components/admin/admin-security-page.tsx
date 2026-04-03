"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";

type Overview = {
  activeSessions: number;
  failedLast24h: number;
  alertsCount: number;
  highRiskCount: number;
};

type LoginEvent = {
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

type SecurityAlert = {
  id: string;
  severity: "high" | "medium" | "low";
  reason: string;
  timestamp: string;
  relatedUserId: string | null;
  relatedIp: string | null;
  evidence: Record<string, number | string | null>;
};

type ActiveSession = {
  sessionId: string;
  userId: string;
  email: string;
  userAgent: string | null;
  ipHint: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string;
};

type HighRiskRow = {
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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function outcomeBadge(outcome: string) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";
  if (outcome === "success") {
    return (
      <span className={`${base} bg-emerald-50 text-emerald-800 ring-emerald-600/15`}>
        success
      </span>
    );
  }
  return (
    <span className={`${base} bg-rose-50 text-rose-800 ring-rose-600/15`}>failed</span>
  );
}

function severityBadge(sev: string) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";
  if (sev === "high") {
    return (
      <span className={`${base} bg-rose-50 text-rose-900 ring-rose-600/20`}>high</span>
    );
  }
  if (sev === "medium") {
    return (
      <span className={`${base} bg-amber-50 text-amber-900 ring-amber-600/20`}>medium</span>
    );
  }
  return (
    <span className={`${base} bg-zinc-100 text-zinc-700 ring-zinc-500/15`}>low</span>
  );
}

export function AdminSecurityPage() {
  const [tab, setTab] = useState<
    "overview" | "logins" | "alerts" | "sessions" | "highRisk"
  >("overview");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);

  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const eventsPageSize = 25;

  const [q, setQ] = useState("");
  const [ip, setIp] = useState("");
  const [device, setDevice] = useState("");
  const [outcome, setOutcome] = useState<"" | "success" | "failed">("");
  const [suspiciousOnly, setSuspiciousOnly] = useState(false);
  const [highRiskOnly, setHighRiskOnly] = useState(false);

  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionQ, setSessionQ] = useState("");
  const sessionsPageSize = 25;

  const [highRisk, setHighRisk] = useState<HighRiskRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/admin/security/overview", { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as Overview;
    setOverview(data);
  }, []);

  const loadEvents = useCallback(async () => {
    const sp = new URLSearchParams({
      page: String(eventsPage),
      pageSize: String(eventsPageSize),
    });
    if (q.trim()) sp.set("q", q.trim());
    if (ip.trim()) sp.set("ip", ip.trim());
    if (device.trim()) sp.set("device", device.trim());
    if (outcome) sp.set("outcome", outcome);
    if (suspiciousOnly) sp.set("suspiciousOnly", "true");
    if (highRiskOnly) sp.set("highRiskOnly", "true");

    const res = await fetch(`/api/admin/security/login-events?${sp}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as {
      events: LoginEvent[];
      total: number;
    };
    setEvents(data.events);
    setEventsTotal(data.total);
  }, [
    eventsPage,
    q,
    ip,
    device,
    outcome,
    suspiciousOnly,
    highRiskOnly,
  ]);

  const loadAlerts = useCallback(async () => {
    const res = await fetch("/api/admin/security/alerts", { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { alerts: SecurityAlert[] };
    setAlerts(data.alerts);
  }, []);

  const loadSessions = useCallback(async () => {
    const sp = new URLSearchParams({
      page: String(sessionsPage),
      pageSize: String(sessionsPageSize),
    });
    if (sessionQ.trim()) sp.set("q", sessionQ.trim());
    const res = await fetch(`/api/admin/security/sessions?${sp}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as {
      sessions: ActiveSession[];
      total: number;
    };
    setSessions(data.sessions);
    setSessionsTotal(data.total);
  }, [sessionsPage, sessionQ]);

  const loadHighRisk = useCallback(async () => {
    const res = await fetch("/api/admin/security/high-risk?limit=50", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { users: HighRiskRow[] };
    setHighRisk(data.users);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadOverview();
      await Promise.all([loadEvents(), loadAlerts(), loadSessions(), loadHighRisk()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [loadAlerts, loadEvents, loadHighRisk, loadOverview, loadSessions]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (tab === "logins") void loadEvents();
  }, [tab, eventsPage, loadEvents]);

  useEffect(() => {
    if (tab === "sessions") void loadSessions();
  }, [tab, sessionsPage, loadSessions]);

  async function revokeSession(id: string) {
    setBusyId(`sess-${id}`);
    try {
      const res = await fetch(`/api/admin/security/sessions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      await loadSessions();
      await loadOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function revokeAllForUser(userId: string) {
    setBusyId(`revoke-${userId}`);
    try {
      const res = await fetch(
        `/api/admin/security/users/${userId}/revoke-sessions`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error(await res.text());
      await loadSessions();
      await loadOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function forceReset(userId: string) {
    setBusyId(`reset-${userId}`);
    try {
      const res = await fetch(
        `/api/admin/security/users/${userId}/force-password-reset`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function securityLock(userId: string) {
    setBusyId(`lock-${userId}`);
    try {
      const res = await fetch(`/api/admin/security/users/${userId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Security lock from admin panel" }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadHighRisk();
      await loadOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function securityUnlock(userId: string) {
    setBusyId(`unlock-${userId}`);
    try {
      const res = await fetch(`/api/admin/security/users/${userId}/unlock`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      await loadHighRisk();
      await loadOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  const tabBtn = (id: typeof tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={
        tab === id
          ? "rounded-lg bg-[#f7f4ff] px-3 py-1.5 text-sm font-medium text-[#5b3dff]"
          : "rounded-lg px-3 py-1.5 text-sm font-medium text-[#555370] hover:bg-[#f4f2fb]"
      }
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1c1b33]">Security Center</h2>
          <p className="text-sm text-[#777394]">
            Login telemetry, sessions, and derived risk signals (real data only).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 rounded-lg border border-[#ece9fb] bg-white px-3 py-2 text-sm font-medium text-[#1c1b33] shadow-sm hover:bg-[#faf9ff]"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-[#ece9fb] pb-2">
        {tabBtn("overview", "Overview")}
        {tabBtn("logins", "Login events")}
        {tabBtn("alerts", "Alerts")}
        {tabBtn("sessions", "Sessions")}
        {tabBtn("highRisk", "High-risk users")}
      </div>

      {tab === "overview" && overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#ece9fb] bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#777394]">
              Active sessions
            </p>
            <p className="mt-1 text-2xl font-semibold text-[#1c1b33]">
              {overview.activeSessions}
            </p>
          </div>
          <div className="rounded-xl border border-[#ece9fb] bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#777394]">
              Failed logins (24h)
            </p>
            <p className="mt-1 text-2xl font-semibold text-[#1c1b33]">
              {overview.failedLast24h}
            </p>
          </div>
          <div className="rounded-xl border border-[#ece9fb] bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#777394]">
              Open alerts
            </p>
            <p className="mt-1 text-2xl font-semibold text-[#1c1b33]">
              {overview.alertsCount}
            </p>
          </div>
          <div className="rounded-xl border border-[#ece9fb] bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-[#777394]">
              High-risk accounts
            </p>
            <p className="mt-1 text-2xl font-semibold text-[#1c1b33]">
              {overview.highRiskCount}
            </p>
          </div>
        </div>
      )}

      {tab === "logins" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <input
              className="min-w-[180px] rounded-lg border border-[#ece9fb] px-3 py-2 text-sm"
              placeholder="Search email / identifier"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void loadEvents()}
            />
            <input
              className="w-40 rounded-lg border border-[#ece9fb] px-3 py-2 text-sm"
              placeholder="IP"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void loadEvents()}
            />
            <input
              className="min-w-[160px] rounded-lg border border-[#ece9fb] px-3 py-2 text-sm"
              placeholder="Device (user-agent)"
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void loadEvents()}
            />
            <select
              className="rounded-lg border border-[#ece9fb] px-3 py-2 text-sm"
              value={outcome}
              onChange={(e) =>
                setOutcome(e.target.value as "" | "success" | "failed")
              }
            >
              <option value="">All outcomes</option>
              <option value="success">success</option>
              <option value="failed">failed</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-[#555370]">
              <input
                type="checkbox"
                checked={suspiciousOnly}
                onChange={(e) => setSuspiciousOnly(e.target.checked)}
              />
              Suspicious only
            </label>
            <label className="flex items-center gap-2 text-sm text-[#555370]">
              <input
                type="checkbox"
                checked={highRiskOnly}
                onChange={(e) => setHighRiskOnly(e.target.checked)}
              />
              High-risk users only
            </label>
            <button
              type="button"
              onClick={() => {
                setEventsPage(1);
                void loadEvents();
              }}
              className="rounded-lg bg-[#5b3dff] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a32d4]"
            >
              Apply
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#ece9fb] bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#ece9fb] bg-[#faf9ff] text-xs uppercase text-[#777394]">
                <tr>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Outcome</th>
                  <th className="px-3 py-2 font-medium">Method</th>
                  <th className="px-3 py-2 font-medium">Context</th>
                  <th className="px-3 py-2 font-medium">Identifier</th>
                  <th className="px-3 py-2 font-medium">IP</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">Failure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f2fb]">
                {events.map((ev) => (
                  <tr key={ev.id} className="text-[#1c1b33]">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-[#555370]">
                      {fmtDate(ev.createdAt)}
                    </td>
                    <td className="px-3 py-2">{outcomeBadge(ev.outcome)}</td>
                    <td className="px-3 py-2">{ev.authMethod}</td>
                    <td className="px-3 py-2">{ev.context}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs">
                      {ev.identifier}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{ev.ipHint ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {[ev.geoCity, ev.geoCountry].filter(Boolean).join(", ") ||
                        "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#777394]">
                      {ev.failureCode ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#555370]">
            <span>
              {eventsTotal} event{eventsTotal === 1 ? "" : "s"} · page {eventsPage}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={eventsPage <= 1}
                onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-[#ece9fb] px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={eventsPage * eventsPageSize >= eventsTotal}
                onClick={() => setEventsPage((p) => p + 1)}
                className="rounded-lg border border-[#ece9fb] px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "alerts" && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-[#ece9fb] bg-white p-8 text-sm text-[#777394]">
              <ShieldAlert className="h-5 w-5" />
              No alerts from current rules. Alerts strengthen as login history grows.
            </div>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-[#ece9fb] bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {severityBadge(a.severity)}
                  <span className="font-medium text-[#1c1b33]">{a.reason}</span>
                </div>
                <p className="mt-1 text-xs text-[#777394]">{fmtDate(a.timestamp)}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#555370]">
                  {a.relatedUserId ? (
                    <span>
                      User:{" "}
                      <Link
                        href={`/admin/users/${a.relatedUserId}`}
                        className="text-[#5b3dff] hover:underline"
                      >
                        {a.relatedUserId}
                      </Link>
                    </span>
                  ) : null}
                  {a.relatedIp ? <span>IP: {a.relatedIp}</span> : null}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "sessions" && (
        <div className="space-y-4">
          <input
            className="max-w-md rounded-lg border border-[#ece9fb] px-3 py-2 text-sm"
            placeholder="Search user email or name"
            value={sessionQ}
            onChange={(e) => setSessionQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void loadSessions()}
          />
          <div className="overflow-x-auto rounded-xl border border-[#ece9fb] bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#ece9fb] bg-[#faf9ff] text-xs uppercase text-[#777394]">
                <tr>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">IP</th>
                  <th className="px-3 py-2 font-medium">Last used</th>
                  <th className="px-3 py-2 font-medium">Expires</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f2fb]">
                {sessions.map((s) => (
                  <tr key={s.sessionId}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/users/${s.userId}`}
                        className="font-medium text-[#5b3dff] hover:underline"
                      >
                        {s.email}
                      </Link>
                      <p className="max-w-xs truncate text-xs text-[#777394]">
                        {s.userAgent ?? "—"}
                      </p>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{s.ipHint ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      {fmtDate(s.lastUsedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      {fmtDate(s.expiresAt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={busyId === `sess-${s.sessionId}`}
                        onClick={() => void revokeSession(s.sessionId)}
                        className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-800 hover:bg-rose-50"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#555370]">
            <span>
              {sessionsTotal} session{sessionsTotal === 1 ? "" : "s"} · page{" "}
              {sessionsPage}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={sessionsPage <= 1}
                onClick={() => setSessionsPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-[#ece9fb] px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={sessionsPage * sessionsPageSize >= sessionsTotal}
                onClick={() => setSessionsPage((p) => p + 1)}
                className="rounded-lg border border-[#ece9fb] px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "highRisk" && (
        <div className="overflow-x-auto rounded-xl border border-[#ece9fb] bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#ece9fb] bg-[#faf9ff] text-xs uppercase text-[#777394]">
              <tr>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Signals</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f2fb]">
              {highRisk.map((h) => (
                <tr key={h.user.id}>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/users/${h.user.id}`}
                      className="font-medium text-[#5b3dff] hover:underline"
                    >
                      {h.user.email}
                    </Link>
                    {h.user.securityLockedUntil ? (
                      <p className="text-xs text-amber-800">
                        Security locked until {fmtDate(h.user.securityLockedUntil)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono">{h.score}</td>
                  <td className="max-w-md px-3 py-2 text-xs text-[#555370]">
                    {Object.entries(h.breakdown)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </td>
                  <td className="space-x-2 whitespace-nowrap px-3 py-2">
                    <button
                      type="button"
                      disabled={busyId === `revoke-${h.user.id}`}
                      onClick={() => void revokeAllForUser(h.user.id)}
                      className="rounded-lg border border-[#ece9fb] px-2 py-1 text-xs hover:bg-[#faf9ff]"
                    >
                      Revoke sessions
                    </button>
                    <button
                      type="button"
                      disabled={busyId === `reset-${h.user.id}`}
                      onClick={() => void forceReset(h.user.id)}
                      className="rounded-lg border border-[#ece9fb] px-2 py-1 text-xs hover:bg-[#faf9ff]"
                    >
                      Force reset
                    </button>
                    {h.user.securityLockedUntil ? (
                      <button
                        type="button"
                        disabled={busyId === `unlock-${h.user.id}`}
                        onClick={() => void securityUnlock(h.user.id)}
                        className="rounded-lg border border-emerald-200 px-2 py-1 text-xs text-emerald-900 hover:bg-emerald-50"
                      >
                        Unlock
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === `lock-${h.user.id}`}
                        onClick={() => void securityLock(h.user.id)}
                        className="rounded-lg border border-amber-200 px-2 py-1 text-xs text-amber-900 hover:bg-amber-50"
                      >
                        Security lock
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {highRisk.length === 0 ? (
            <p className="p-6 text-sm text-[#777394]">
              No accounts match high-risk heuristics yet.
            </p>
          ) : null}
        </div>
      )}

      {loading && !overview ? (
        <div className="flex items-center gap-2 text-sm text-[#777394]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : null}
    </div>
  );
}
