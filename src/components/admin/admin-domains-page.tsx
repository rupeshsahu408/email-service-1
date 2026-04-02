"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Globe,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";

type DomainRow = {
  id: string;
  domainName: string;
  ownerEmail: string;
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

function badge(
  label: string,
  tone: "neutral" | "ok" | "warn" | "bad"
) {
  const map = {
    neutral: "bg-zinc-100 text-zinc-700 ring-zinc-500/15",
    ok: "bg-emerald-50 text-emerald-800 ring-emerald-600/15",
    warn: "bg-amber-50 text-amber-900 ring-amber-600/20",
    bad: "bg-rose-50 text-rose-900 ring-rose-600/20",
  };
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";
  return (
    <span className={`${base} ${map[tone]}`}>{label}</span>
  );
}

function recordTone(
  s: string | null
): "neutral" | "ok" | "warn" | "bad" {
  if (!s) return "neutral";
  if (s === "pass") return "ok";
  if (s === "warning") return "warn";
  return "bad";
}

export function AdminDomainsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [verification, setVerification] = useState<"all" | "verified" | "unverified">("all");
  const [operational, setOperational] = useState<"all" | "active" | "suspended" | "pending">("all");
  const [sending, setSending] = useState<"all" | "enabled" | "disabled">("all");
  const [sendingSource, setSendingSource] = useState<"all" | "admin" | "system">("all");
  const [spf, setSpf] = useState<"all" | "pass" | "fail">("all");
  const [dkim, setDkim] = useState<"all" | "pass" | "fail">("all");
  const [dmarc, setDmarc] = useState<"all" | "pass" | "fail">("all");
  const [mx, setMx] = useState<"all" | "pass" | "fail">("all");
  const [recentDays, setRecentDays] = useState<number | "">("");
  const [sort, setSort] = useState<
    "newest" | "oldest" | "domain_name" | "last_check" | "verification_status"
  >("newest");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    domainName: "",
    ownerUserId: "",
    adminNotes: "",
  });

  const [confirm, setConfirm] = useState<{
    title: string;
    detail: string;
    destructive?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("pageSize", String(pageSize));
      if (q.trim()) sp.set("q", q.trim());
      sp.set("verification", verification);
      sp.set("operational", operational);
      sp.set("sending", sending);
      sp.set("sendingSource", sendingSource);
      sp.set("spf", spf);
      sp.set("dkim", dkim);
      sp.set("dmarc", dmarc);
      sp.set("mx", mx);
      sp.set("sort", sort);
      if (recentDays !== "" && recentDays > 0) {
        sp.set("recentDays", String(recentDays));
      }
      const res = await fetch(`/api/admin/domains?${sp.toString()}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not load domains");
      }
      setDomains(data.domains ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    q,
    verification,
    operational,
    sending,
    sendingSource,
    spf,
    dkim,
    dmarc,
    mx,
    recentDays,
    sort,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 400);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    setPage(1);
  }, [
    q,
    verification,
    operational,
    sending,
    sendingSource,
    spf,
    dkim,
    dmarc,
    mx,
    recentDays,
    sort,
  ]);

  const allSelected = useMemo(() => {
    if (domains.length === 0) return false;
    return domains.every((d) => selected.has(d.id));
  }, [domains, selected]);

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(domains.map((d) => d.id)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function runBulk(
    action:
      | "recheck_dns"
      | "verify_dns"
      | "suspend"
      | "unsuspend"
      | "disable_sending"
      | "enable_sending"
  ) {
    if (selected.size === 0) return;
    const domainIds = Array.from(selected);
    if (action === "suspend") {
      const reason =
        typeof window !== "undefined"
          ? window.prompt("Suspension reason (optional)", "")?.trim() ?? ""
          : "";
      setBulkBusy(true);
      try {
        const res = await fetch("/api/admin/domains/bulk", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "suspend",
            domainIds,
            reason: reason || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Bulk failed");
        setSelected(new Set());
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Bulk failed");
      } finally {
        setBulkBusy(false);
      }
      return;
    }
    if (action === "disable_sending") {
      const reason =
        typeof window !== "undefined"
          ? window.prompt("Reason (optional)", "")?.trim() ?? ""
          : "";
      setBulkBusy(true);
      try {
        const res = await fetch("/api/admin/domains/bulk", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "disable_sending",
            domainIds,
            reason: reason || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Bulk failed");
        setSelected(new Set());
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Bulk failed");
      } finally {
        setBulkBusy(false);
      }
      return;
    }
    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/domains/bulk", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, domainIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Bulk failed");
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk failed");
    } finally {
      setBulkBusy(false);
    }
  }

  async function exportCsv(mode: "selection" | "filter") {
    const sp = new URLSearchParams();
    if (mode === "selection") {
      if (selected.size === 0) return;
      sp.set("ids", Array.from(selected).join(","));
    } else {
      if (q.trim()) sp.set("q", q.trim());
      sp.set("verification", verification);
      sp.set("operational", operational);
      sp.set("sending", sending);
      sp.set("sendingSource", sendingSource);
      sp.set("spf", spf);
      sp.set("dkim", dkim);
      sp.set("dmarc", dmarc);
      sp.set("mx", mx);
      sp.set("sort", sort);
      if (recentDays !== "" && recentDays > 0) {
        sp.set("recentDays", String(recentDays));
      }
    }
    const res = await fetch(`/api/admin/domains/export?${sp.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) {
      setError("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "domains-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function submitCreate() {
    setCreateBusy(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/domains", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          domainName: createForm.domainName.trim(),
          ownerUserId: createForm.ownerUserId.trim(),
          adminNotes: createForm.adminNotes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not create domain");
      }
      setShowCreate(false);
      setCreateForm({ domainName: "", ownerUserId: "", adminNotes: "" });
      await load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1c1b33]">Domains</h2>
          <p className="text-sm text-[#777394]">
            Custom domains, DNS checks, and sending controls.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#5b3dff] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a32d4]"
        >
          <Plus className="h-4 w-4" />
          Add domain
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#ece9fb] bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a09cb8]" />
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search domain, owner, user id…"
              className="w-full rounded-lg border border-[#e4e0f5] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#5b3dff]"
            />
          </div>
          <select
            value={verification}
            onChange={(e) =>
              setVerification(e.target.value as typeof verification)
            }
            className="rounded-lg border border-[#e4e0f5] px-2 py-2 text-sm"
          >
            <option value="all">Verification: all</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
          <select
            value={operational}
            onChange={(e) =>
              setOperational(e.target.value as typeof operational)
            }
            className="rounded-lg border border-[#e4e0f5] px-2 py-2 text-sm"
          >
            <option value="all">Operational: all</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
          <select
            value={sending}
            onChange={(e) => setSending(e.target.value as typeof sending)}
            className="rounded-lg border border-[#e4e0f5] px-2 py-2 text-sm"
          >
            <option value="all">Sending: all</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
          <select
            value={sendingSource}
            onChange={(e) =>
              setSendingSource(e.target.value as typeof sendingSource)
            }
            className="rounded-lg border border-[#e4e0f5] px-2 py-2 text-sm"
          >
            <option value="all">Disable source: all</option>
            <option value="admin">Admin disabled</option>
            <option value="system">System disabled</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={spf}
            onChange={(e) => setSpf(e.target.value as typeof spf)}
            className="rounded-lg border border-[#e4e0f5] px-2 py-2 text-sm"
          >
            <option value="all">SPF: all</option>
            <option value="pass">SPF pass</option>
            <option value="fail">SPF fail</option>
          </select>
          <select
            value={dkim}
            onChange={(e) => setDkim(e.target.value as typeof dkim)}
            className="rounded-lg border border-[#e4e0f5] px-2 py-2 text-sm"
          >
            <option value="all">DKIM: all</option>
            <option value="pass">DKIM pass</option>
            <option value="fail">DKIM fail</option>
          </select>
          <select
            value={dmarc}
            onChange={(e) => setDmarc(e.target.value as typeof dmarc)}
            className="rounded-lg border border-[#e4e0f5] px-2 py-2 text-sm"
          >
            <option value="all">DMARC: all</option>
            <option value="pass">DMARC pass</option>
            <option value="fail">DMARC fail</option>
          </select>
          <select
            value={mx}
            onChange={(e) => setMx(e.target.value as typeof mx)}
            className="rounded-lg border border-[#e4e0f5] px-2 py-2 text-sm"
          >
            <option value="all">MX: all</option>
            <option value="pass">MX pass</option>
            <option value="fail">MX fail</option>
          </select>
          <input
            type="number"
            min={1}
            max={365}
            placeholder="Recent days"
            value={recentDays === "" ? "" : String(recentDays)}
            onChange={(e) => {
              const v = e.target.value;
              setRecentDays(v === "" ? "" : Number(v));
            }}
            className="w-28 rounded-lg border border-[#e4e0f5] px-2 py-2 text-sm"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-lg border border-[#e4e0f5] px-2 py-2 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="domain_name">Domain A–Z</option>
            <option value="last_check">Last checked</option>
            <option value="verification_status">Verification status</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </div>
      )}

      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#ece9fb] bg-[#f7f4ff] px-3 py-2 text-sm">
          <span className="font-medium text-[#1c1b33]">
            {selected.size} selected
          </span>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void runBulk("verify_dns")}
            className="rounded-md bg-white px-2 py-1 ring-1 ring-[#e4e0f5] hover:bg-[#faf9ff]"
          >
            Verify TXT
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void runBulk("recheck_dns")}
            className="rounded-md bg-white px-2 py-1 ring-1 ring-[#e4e0f5] hover:bg-[#faf9ff]"
          >
            Recheck DNS
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void runBulk("suspend")}
            className="rounded-md bg-white px-2 py-1 ring-1 ring-amber-200 hover:bg-amber-50"
          >
            Suspend
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void runBulk("unsuspend")}
            className="rounded-md bg-white px-2 py-1 ring-1 ring-[#e4e0f5] hover:bg-[#faf9ff]"
          >
            Unsuspend
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void runBulk("disable_sending")}
            className="rounded-md bg-white px-2 py-1 ring-1 ring-rose-200 hover:bg-rose-50"
          >
            Disable sending
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void runBulk("enable_sending")}
            className="rounded-md bg-white px-2 py-1 ring-1 ring-emerald-200 hover:bg-emerald-50"
          >
            Enable sending
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void exportCsv("selection")}
            className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 ring-1 ring-[#e4e0f5]"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
          {bulkBusy && <Loader2 className="h-4 w-4 animate-spin text-[#5b3dff]" />}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#ece9fb] bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#777394]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : domains.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-[#777394]">
            <Globe className="h-10 w-10 opacity-40" />
            <p>No domains match your filters.</p>
          </div>
        ) : (
          <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#ece9fb] bg-[#faf9ff] text-xs font-medium text-[#555370]">
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-3 py-2">Domain</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Verification</th>
                <th className="px-3 py-2">SPF</th>
                <th className="px-3 py-2">DKIM</th>
                <th className="px-3 py-2">DMARC</th>
                <th className="px-3 py-2">MX</th>
                <th className="px-3 py-2">Operational</th>
                <th className="px-3 py-2">Sending</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Last check</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-[#f4f2fb] hover:bg-[#faf9ff]/80"
                >
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={selected.has(d.id)}
                      onChange={() => toggleOne(d.id)}
                      aria-label={`Select ${d.domainName}`}
                    />
                  </td>
                  <td className="px-3 py-2 align-top font-medium text-[#1c1b33]">
                    <Link
                      href={`/admin/domains/${d.id}`}
                      className="text-[#5b3dff] hover:underline"
                    >
                      {d.domainName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 align-top text-[#555370]">
                    {d.ownerEmail}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {d.verificationStatus === "verified"
                      ? badge("Verified", "ok")
                      : badge(d.verificationStatus, "warn")}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {d.spfStatus
                      ? badge(d.spfStatus, recordTone(d.spfStatus))
                      : badge("—", "neutral")}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {d.dkimStatus
                      ? badge(d.dkimStatus, recordTone(d.dkimStatus))
                      : badge("—", "neutral")}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {d.dmarcStatus
                      ? badge(d.dmarcStatus, recordTone(d.dmarcStatus))
                      : badge("—", "neutral")}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {d.mxStatus
                      ? badge(d.mxStatus, recordTone(d.mxStatus))
                      : badge("—", "neutral")}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {d.operationalStatus === "active"
                      ? badge("Active", "ok")
                      : d.operationalStatus === "suspended"
                        ? badge("Suspended", "bad")
                        : badge("Pending", "warn")}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {d.sendingEnabled ? (
                      badge("Enabled", "ok")
                    ) : d.sendingDisabledSource === "admin" ? (
                      badge("Off (admin)", "bad")
                    ) : (
                      badge("Off (system)", "warn")
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-[#555370]">
                    {fmtDate(d.createdAt)}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-[#555370]">
                    {fmtDate(d.lastCheckAt)}
                  </td>
                  <td className="px-3 py-2 align-top relative">
                    <button
                      type="button"
                      className="rounded p-1 hover:bg-[#ece9fb]"
                      onClick={() =>
                        setMenuOpen(menuOpen === d.id ? null : d.id)
                      }
                      aria-label="Actions"
                    >
                      <MoreHorizontal className="h-4 w-4 text-[#555370]" />
                    </button>
                    {menuOpen === d.id && (
                      <div className="absolute right-0 z-20 mt-1 min-w-[180px] rounded-lg border border-[#ece9fb] bg-white py-1 shadow-lg">
                        <Link
                          href={`/admin/domains/${d.id}`}
                          className="block px-3 py-2 text-sm hover:bg-[#f7f4ff]"
                          onClick={() => setMenuOpen(null)}
                        >
                          View details
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => void exportCsv("filter")}
          className="inline-flex items-center gap-2 rounded-lg border border-[#ece9fb] bg-white px-3 py-2 text-sm text-[#1c1b33] hover:bg-[#faf9ff]"
        >
          <Download className="h-4 w-4" />
          Export filtered CSV
        </button>
        <div className="flex items-center gap-2 text-sm text-[#555370]">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-[#ece9fb] px-2 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-[#ece9fb] px-2 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[#1c1b33]">Add domain</h3>
            <p className="mt-1 text-sm text-[#777394]">
              Domain name must be unique. Owner is the user id (UUID) from Users.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-[#555370]">
                  Domain name
                </label>
                <input
                  value={createForm.domainName}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, domainName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#e4e0f5] px-3 py-2 text-sm"
                  placeholder="example.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#555370]">
                  Owner user id
                </label>
                <input
                  value={createForm.ownerUserId}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, ownerUserId: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#e4e0f5] px-3 py-2 text-sm font-mono text-xs"
                  placeholder="uuid"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#555370]">
                  Notes (optional)
                </label>
                <textarea
                  value={createForm.adminNotes}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, adminNotes: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-[#e4e0f5] px-3 py-2 text-sm"
                  rows={3}
                />
              </div>
              {createError && (
                <p className="text-sm text-rose-700">{createError}</p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg px-3 py-2 text-sm text-[#555370] hover:bg-[#f4f2fb]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={createBusy}
                onClick={() => void submitCreate()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#5b3dff] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {createBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[#1c1b33]">
              {confirm.title}
            </h3>
            <p className="mt-2 text-sm text-[#555370]">{confirm.detail}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="rounded-lg px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirm.onConfirm()}
                className={`rounded-lg px-3 py-2 text-sm text-white ${
                  confirm.destructive ? "bg-rose-600" : "bg-[#5b3dff]"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
