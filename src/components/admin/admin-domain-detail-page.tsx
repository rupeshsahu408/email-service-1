"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ClipboardCopy,
  Loader2,
  RefreshCw,
  Shield,
} from "lucide-react";

type CheckRow = {
  id: string;
  checkType: string;
  status: string;
  expectedSummary: string | null;
  observedRaw: Record<string, unknown> | null;
  checkedAt: string;
  errorMessage: string | null;
};

type ActivityRow = {
  id: string;
  eventType: string;
  actorType: string;
  actorUserId: string | null;
  detail: string | null;
  createdAt: string;
};

type DetailPayload = {
  domain: {
    id: string;
    domainName: string;
    ownerUserId: string;
    verificationStatus: string;
    operationalStatus: string;
    sendingEnabled: boolean;
    sendingDisabledSource: string | null;
    sendingDisableReason: string | null;
    suspendedAt: string | null;
    suspensionReason: string | null;
    adminNotes: string | null;
    dkimSelector: string;
    createdAt: string;
    updatedAt: string;
    lastCheckAt: string | null;
    verifiedAt: string | null;
    verificationToken: string;
  };
  ownerEmail: string;
  checks: CheckRow[];
  latestDiagnostics: {
    issues: {
      code: string;
      severity: string;
      message: string;
      fix?: string;
    }[];
    health: string;
    computedAt: string;
  } | null;
  mailboxCount: number;
  linkedUsersCount: number;
  scheduledSendCount: number;
  activity: ActivityRow[];
  dnsUi: {
    records: { type: string; name: string; value: string; purpose: string }[];
    verificationHost: string;
    verificationTxt: string;
  };
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

export function AdminDomainDetailPage({ domainId }: { domainId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DetailPayload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/domains/${domainId}`, {
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Failed to load");
      setData(j as DetailPayload);
      setNotes(j.domain?.adminNotes ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [domainId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(path: string, body?: Record<string, unknown>) {
    setBusy(path);
    try {
      const res = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : "{}",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Request failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveNotes() {
    setBusy("notes");
    setNotesSaved(false);
    try {
      const res = await fetch(`/api/admin/domains/${domainId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adminNotes: notes }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Save failed");
      }
      setNotesSaved(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#777394]">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        Loading domain…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <Link
          href="/admin/domains"
          className="inline-flex items-center gap-1 text-sm text-[#5b3dff]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to domains
        </Link>
        <p className="mt-6 text-rose-700">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const d = data.domain;
  const latestByType = new Map<string, CheckRow>();
  for (const c of data.checks) {
    if (!latestByType.has(c.checkType)) latestByType.set(c.checkType, c);
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <Link
        href="/admin/domains"
        className="inline-flex items-center gap-1 text-sm text-[#5b3dff] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Domains
      </Link>

      <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#1c1b33]">{d.domainName}</h2>
          <p className="font-mono text-xs text-[#777394]">{d.id}</p>
          <p className="mt-1 text-sm text-[#555370]">
            Owner: {data.ownerEmail}{" "}
            <span className="font-mono text-xs">({d.ownerUserId})</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={() =>
              void post(`/api/admin/domains/${domainId}/verify`)
            }
            className="inline-flex items-center gap-1 rounded-lg border border-[#ece9fb] bg-white px-3 py-2 text-sm"
          >
            {busy === `/api/admin/domains/${domainId}/verify` ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            Verify TXT
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() =>
              void post(`/api/admin/domains/${domainId}/recheck-dns`)
            }
            className="inline-flex items-center gap-1 rounded-lg border border-[#ece9fb] bg-white px-3 py-2 text-sm"
          >
            {busy === `/api/admin/domains/${domainId}/recheck-dns` ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Recheck DNS
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#ece9fb] bg-white p-4">
          <h3 className="text-sm font-semibold text-[#1c1b33]">Status</h3>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[#777394]">Verification</dt>
              <dd className="font-medium">{d.verificationStatus}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#777394]">Operational</dt>
              <dd className="font-medium">{d.operationalStatus}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#777394]">Sending</dt>
              <dd className="font-medium">
                {d.sendingEnabled
                  ? "Enabled"
                  : d.sendingDisabledSource === "admin"
                    ? "Disabled (admin)"
                    : "Disabled (system)"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#777394]">DKIM selector</dt>
              <dd className="font-mono text-xs">{d.dkimSelector}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#777394]">Verified at</dt>
              <dd>{fmt(d.verifiedAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#777394]">Last DNS check</dt>
              <dd>{fmt(d.lastCheckAt)}</dd>
            </div>
          </dl>
          {d.operationalStatus === "suspended" && (
            <p className="mt-3 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-950">
              Suspended: {fmt(d.suspendedAt)} — {d.suspensionReason ?? "—"}
            </p>
          )}
          {!d.sendingEnabled && d.sendingDisableReason && (
            <p className="mt-2 text-xs text-[#555370]">
              Sending note: {d.sendingDisableReason}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-[#ece9fb] bg-white p-4">
          <h3 className="text-sm font-semibold text-[#1c1b33]">Usage</h3>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[#777394]">Mailboxes</dt>
              <dd>{data.mailboxCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#777394]">Linked users</dt>
              <dd>{data.linkedUsersCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#777394]">Scheduled sends (mailbox)</dt>
              <dd>{data.scheduledSendCount}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[#ece9fb] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#1c1b33]">
          Required DNS (expected)
        </h3>
        <ul className="mt-3 space-y-3 text-sm">
          {data.dnsUi.records.map((r, i) => (
            <li
              key={i}
              className="rounded-lg border border-[#f4f2fb] bg-[#faf9ff] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {r.type} {r.name}
                </span>
                <button
                  type="button"
                  onClick={() => void copyText(r.value)}
                  className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs ring-1 ring-[#ece9fb]"
                >
                  <ClipboardCopy className="h-3 w-3" />
                  Copy value
                </button>
              </div>
              <p className="mt-1 font-mono text-xs break-all text-[#1c1b33]">
                {r.value}
              </p>
              <p className="mt-1 text-xs text-[#777394]">{r.purpose}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 rounded-xl border border-[#ece9fb] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#1c1b33]">
          Live DNS checks (latest run)
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#ece9fb] text-xs text-[#777394]">
                <th className="py-2 pr-3">Check</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Expected</th>
                <th className="py-2">Observed / error</th>
              </tr>
            </thead>
            <tbody>
              {["verification_txt", "spf", "dkim", "dmarc", "mx"].map((t) => {
                const row = latestByType.get(t);
                const obs = row?.observedRaw
                  ? JSON.stringify(row.observedRaw, null, 0)
                  : "—";
                return (
                  <tr key={t} className="border-b border-[#f4f2fb] align-top">
                    <td className="py-2 pr-3 font-mono text-xs">{t}</td>
                    <td className="py-2 pr-3">{row?.status ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs text-[#555370]">
                      {row?.expectedSummary ?? "—"}
                    </td>
                    <td className="py-2 font-mono text-xs break-all text-[#1c1b33]">
                      {row?.errorMessage ? (
                        <span className="text-rose-800">{row.errorMessage}</span>
                      ) : (
                        obs
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {data.latestDiagnostics && (
        <div className="mt-6 rounded-xl border border-[#ece9fb] bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#1c1b33]">
              Diagnostics
            </h3>
            <span className="text-xs text-[#777394]">
              Health:{" "}
              <strong className="text-[#1c1b33]">
                {data.latestDiagnostics.health}
              </strong>{" "}
              · {fmt(data.latestDiagnostics.computedAt)}
            </span>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {data.latestDiagnostics.issues.map((issue, i) => (
              <li
                key={i}
                className="rounded-lg border border-[#f4f2fb] px-3 py-2"
              >
                <span className="text-xs font-medium uppercase text-[#777394]">
                  [{issue.severity}] {issue.code}
                </span>
                <p className="text-[#1c1b33]">{issue.message}</p>
                {issue.fix && (
                  <p className="mt-1 text-xs text-[#555370]">Fix: {issue.fix}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-[#ece9fb] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#1c1b33]">Admin actions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {d.operationalStatus === "suspended" ? (
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                void post(`/api/admin/domains/${domainId}/unsuspend`)
              }
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white"
            >
              Unsuspend
            </button>
          ) : (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => {
                const reason =
                  typeof window !== "undefined"
                    ? window.prompt("Suspension reason", "")?.trim() ?? ""
                    : "";
                void post(`/api/admin/domains/${domainId}/suspend`, {
                  reason: reason || undefined,
                });
              }}
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm text-white"
            >
              Suspend domain
            </button>
          )}
          {d.sendingEnabled ? (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => {
                const reason =
                  typeof window !== "undefined"
                    ? window.prompt("Reason (optional)", "")?.trim() ?? ""
                    : "";
                void post(
                  `/api/admin/domains/${domainId}/sending/disable`,
                  { reason: reason || undefined }
                );
              }}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900"
            >
              Disable sending
            </button>
          ) : (
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                void post(`/api/admin/domains/${domainId}/sending/enable`)
              }
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
            >
              Enable sending
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[#ece9fb] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#1c1b33]">Admin notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-2 w-full rounded-lg border border-[#e4e0f5] px-3 py-2 text-sm"
          rows={4}
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={busy === "notes"}
            onClick={() => void saveNotes()}
            className="rounded-lg bg-[#5b3dff] px-3 py-2 text-sm text-white"
          >
            Save notes
          </button>
          {notesSaved && (
            <span className="text-xs text-emerald-700">Saved.</span>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[#ece9fb] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#1c1b33]">
          Recent activity
        </h3>
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
          {data.activity.length === 0 ? (
            <li className="text-[#777394]">No activity yet.</li>
          ) : (
            data.activity.map((a) => (
              <li
                key={a.id}
                className="border-b border-[#f4f2fb] pb-2 text-xs text-[#555370]"
              >
                <span className="font-medium text-[#1c1b33]">
                  {a.eventType}
                </span>{" "}
                · {a.actorType} · {fmt(a.createdAt)}
                {a.detail && (
                  <span className="mt-0.5 block text-[#777394]">{a.detail}</span>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
