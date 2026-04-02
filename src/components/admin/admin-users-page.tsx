"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Download,
  ShieldCheck,
} from "lucide-react";

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  plan: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  storageUsedBytes: number;
};

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

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

function statusBadge(status: string) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";
  if (status === "active") {
    return (
      <span className={`${base} bg-emerald-50 text-emerald-800 ring-emerald-600/15`}>
        Active
      </span>
    );
  }
  if (status === "suspended") {
    return (
      <span className={`${base} bg-amber-50 text-amber-900 ring-amber-600/20`}>
        Suspended
      </span>
    );
  }
  return (
    <span className={`${base} bg-zinc-100 text-zinc-700 ring-zinc-500/15`}>Deleted</span>
  );
}

export function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "suspended" | "deleted">("all");
  const [verified, setVerified] = useState<"all" | "true" | "false">("all");
  const [plan, setPlan] = useState<"all" | "free" | "business" | "pro">("all");
  const [sort, setSort] = useState<
    "newest" | "oldest" | "name" | "email" | "last_login"
  >("newest");
  const [signupFrom, setSignupFrom] = useState("");
  const [signupTo, setSignupTo] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    password: "",
    plan: "free" as "free" | "business" | "pro",
    accountType: "personal" as "personal" | "business" | "professional",
    accountStatus: "active" as "active" | "suspended",
    emailVerified: true,
    isAdmin: false,
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
      sp.set("status", status);
      sp.set("emailVerified", verified);
      sp.set("plan", plan);
      sp.set("sort", sort);
      if (signupFrom) sp.set("signupFrom", signupFrom);
      if (signupTo) sp.set("signupTo", signupTo);
      const res = await fetch(`/api/admin/users?${sp.toString()}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not load users");
      }
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q, status, verified, plan, sort, signupFrom, signupTo]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 400);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    setPage(1);
  }, [q, status, verified, plan, sort, signupFrom, signupTo]);

  const allSelected = useMemo(() => {
    if (users.length === 0) return false;
    return users.every((u) => selected.has(u.id));
  }, [users, selected]);

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map((u) => u.id)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function runBulk(action: "suspend" | "unsuspend" | "verify" | "delete") {
    if (selected.size === 0) return;
    const userIds = Array.from(selected);
    if (action === "delete") {
      setConfirm({
        title: "Delete selected users?",
        detail: `${userIds.length} account(s) will be soft-deleted and signed out.`,
        destructive: true,
        onConfirm: async () => {
          setBulkBusy(true);
          try {
            const res = await fetch("/api/admin/users/bulk", {
              method: "POST",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "delete", userIds }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
            setSelected(new Set());
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Bulk delete failed");
          } finally {
            setBulkBusy(false);
            setConfirm(null);
          }
        },
      });
      return;
    }
    setBulkBusy(true);
    try {
      const body: Record<string, unknown> = { action, userIds };
      if (action === "suspend") {
        const reason =
          typeof window !== "undefined"
            ? window.prompt("Suspension reason (optional)", "")?.trim() ?? ""
            : "";
        body.reason = reason || undefined;
      }
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Bulk action failed");
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk action failed");
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
      sp.set("status", status);
      sp.set("emailVerified", verified);
      sp.set("plan", plan);
      sp.set("sort", sort);
      if (signupFrom) sp.set("signupFrom", signupFrom);
      if (signupTo) sp.set("signupTo", signupTo);
    }
    const res = await fetch(`/api/admin/users/export?${sp.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateBusy(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not create user");
      setShowCreate(false);
      setCreateForm({
        fullName: "",
        email: "",
        password: "",
        plan: "free",
        accountType: "personal",
        accountStatus: "active",
        emailVerified: true,
        isAdmin: false,
      });
      setPage(1);
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreateBusy(false);
    }
  }

  async function rowAction(
    id: string,
    kind:
      | "suspend"
      | "unsuspend"
      | "verify"
      | "unverify"
      | "delete"
      | "reset"
      | "logout"
  ) {
    setMenuOpen(null);
    if (kind === "delete") {
      setConfirm({
        title: "Delete this user?",
        detail: "The account will be soft-deleted and all sessions revoked.",
        destructive: true,
        onConfirm: async () => {
          try {
            const res = await fetch(`/api/admin/users/${id}`, {
              method: "DELETE",
              credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error ?? "Delete failed");
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Delete failed");
          } finally {
            setConfirm(null);
          }
        },
      });
      return;
    }
    if (kind === "suspend") {
      const reason =
        typeof window !== "undefined"
          ? window.prompt("Suspension reason (optional)", "")?.trim() ?? ""
          : "";
      const res = await fetch(`/api/admin/users/${id}/suspend`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Suspend failed");
        return;
      }
      await load();
      return;
    }

    const paths: Record<string, string> = {
      unsuspend: `/api/admin/users/${id}/unsuspend`,
      verify: `/api/admin/users/${id}/verify-email`,
      unverify: `/api/admin/users/${id}/unverify-email`,
      reset: `/api/admin/users/${id}/reset-password`,
      logout: `/api/admin/users/${id}/force-logout`,
    };
    const res = await fetch(paths[kind], {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? `${kind} failed`);
      return;
    }
    if (kind === "reset" && data.warning) {
      setError(String(data.warning));
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1c1b33]">Users</h2>
          <p className="text-sm text-[#777394]">
            Search, filter, and manage accounts. All actions apply in real time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5b3dff] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4a32d6]"
        >
          <Plus className="h-4 w-4" />
          Create user
        </button>
      </div>

      <div className="rounded-2xl border border-[#ece9fb] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a39fc4]" />
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search name, email, user id, or domain…"
              className="w-full rounded-xl border border-[#e4e0f7] bg-[#faf9ff] py-2.5 pl-10 pr-3 text-sm text-[#1c1b33] outline-none ring-[#5b3dff]/25 focus:border-[#c9c2f5] focus:ring-2"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="rounded-xl border border-[#e4e0f7] bg-white px-3 py-2 text-sm text-[#1c1b33]"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="deleted">Deleted</option>
            </select>
            <select
              value={verified}
              onChange={(e) => setVerified(e.target.value as typeof verified)}
              className="rounded-xl border border-[#e4e0f7] bg-white px-3 py-2 text-sm text-[#1c1b33]"
            >
              <option value="all">Email verified: any</option>
              <option value="true">Verified</option>
              <option value="false">Not verified</option>
            </select>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as typeof plan)}
              className="rounded-xl border border-[#e4e0f7] bg-white px-3 py-2 text-sm text-[#1c1b33]"
            >
              <option value="all">All plans</option>
              <option value="free">Free</option>
              <option value="business">Business</option>
              <option value="pro">Pro</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="rounded-xl border border-[#e4e0f7] bg-white px-3 py-2 text-sm text-[#1c1b33]"
            >
              <option value="newest">Newest signup</option>
              <option value="oldest">Oldest signup</option>
              <option value="name">Name (A–Z)</option>
              <option value="email">Email (A–Z)</option>
              <option value="last_login">Last login</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[#f0eefb] pt-3">
          <input
            type="date"
            value={signupFrom}
            onChange={(e) => setSignupFrom(e.target.value)}
            className="rounded-xl border border-[#e4e0f7] bg-white px-3 py-2 text-sm"
          />
          <span className="self-center text-sm text-[#777394]">to</span>
          <input
            type="date"
            value={signupTo}
            onChange={(e) => setSignupTo(e.target.value)}
            className="rounded-xl border border-[#e4e0f7] bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              setSignupFrom("");
              setSignupTo("");
            }}
            className="rounded-xl border border-transparent px-3 py-2 text-sm text-[#5b3dff] hover:bg-[#f7f4ff]"
          >
            Clear dates
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e4e0f7] bg-[#f7f4ff] px-4 py-3 text-sm text-[#1c1b33]">
          <span className="font-medium">{selected.size} selected</span>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void runBulk("suspend")}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium shadow-sm ring-1 ring-[#e4e0f7] hover:bg-[#faf9ff] disabled:opacity-50"
          >
            Suspend
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void runBulk("unsuspend")}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium shadow-sm ring-1 ring-[#e4e0f7] hover:bg-[#faf9ff] disabled:opacity-50"
          >
            Unsuspend
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void runBulk("verify")}
            className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium shadow-sm ring-1 ring-[#e4e0f7] hover:bg-[#faf9ff] disabled:opacity-50"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Verify email
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void exportCsv("selection")}
            className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium shadow-sm ring-1 ring-[#e4e0f7] hover:bg-[#faf9ff] disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void runBulk("delete")}
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => void exportCsv("filter")}
          className="inline-flex items-center gap-2 rounded-xl border border-[#e4e0f7] bg-white px-4 py-2 text-sm font-medium text-[#1c1b33] shadow-sm hover:bg-[#faf9ff]"
        >
          <Download className="h-4 w-4" />
          Export filtered CSV
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
          <button
            type="button"
            className="ml-3 text-red-700 underline"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#ece9fb] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#ece9fb] bg-[#faf9ff] text-xs font-semibold uppercase tracking-wide text-[#777394]">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all on page"
                  />
                </th>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Plan</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Verified</th>
                <th className="px-3 py-3">Created</th>
                <th className="px-3 py-3">Last login</th>
                <th className="px-3 py-3">Storage</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-[#777394]">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#5b3dff]" />
                    <p className="mt-2 text-sm">Loading users…</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-[#777394]">
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-[#f4f2fb] last:border-0 hover:bg-[#fcfbff]"
                  >
                    <td className="px-3 py-3 align-middle">
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => toggleOne(u.id)}
                        aria-label={`Select ${u.email}`}
                      />
                    </td>
                    <td className="px-3 py-3 align-middle font-medium text-[#1c1b33]">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="hover:text-[#5b3dff] hover:underline"
                      >
                        {u.fullName}
                      </Link>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-3 align-middle text-[#555370]">
                      {u.email}
                    </td>
                    <td className="px-3 py-3 align-middle capitalize text-[#555370]">{u.plan}</td>
                    <td className="px-3 py-3 align-middle">{statusBadge(u.status)}</td>
                    <td className="px-3 py-3 align-middle">
                      {u.emailVerified ? (
                        <span className="text-emerald-700">Yes</span>
                      ) : (
                        <span className="text-amber-800">No</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-middle text-[#555370]">
                      {fmtDate(u.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-middle text-[#555370]">
                      {fmtDate(u.lastLoginAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-middle text-[#555370]">
                      {formatBytes(u.storageUsedBytes)}
                    </td>
                    <td className="relative px-3 py-3 text-right align-middle">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-lg p-2 text-[#555370] hover:bg-[#f0eefb]"
                        aria-label="Row actions"
                        onClick={() =>
                          setMenuOpen((cur) => (cur === u.id ? null : u.id))
                        }
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuOpen === u.id && (
                        <div className="absolute right-3 top-10 z-50 w-52 rounded-xl border border-[#ece9fb] bg-white py-1 text-left shadow-lg">
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="block px-3 py-2 text-sm hover:bg-[#f7f4ff]"
                            onClick={() => setMenuOpen(null)}
                          >
                            View details
                          </Link>
                          {u.status === "active" ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-[#f7f4ff]"
                              onClick={() => void rowAction(u.id, "suspend")}
                            >
                              Suspend
                            </button>
                          ) : u.status === "suspended" ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm hover:bg-[#f7f4ff]"
                              onClick={() => void rowAction(u.id, "unsuspend")}
                            >
                              Unsuspend
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-[#f7f4ff]"
                            onClick={() => void rowAction(u.id, "verify")}
                          >
                            Mark verified
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-[#f7f4ff]"
                            onClick={() => void rowAction(u.id, "unverify")}
                          >
                            Mark unverified
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-[#f7f4ff]"
                            onClick={() => void rowAction(u.id, "reset")}
                          >
                            Reset password
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-[#f7f4ff]"
                            onClick={() => void rowAction(u.id, "logout")}
                          >
                            Force logout
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                            onClick={() => void rowAction(u.id, "delete")}
                          >
                            Delete user
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-[#ece9fb] px-4 py-3 text-sm text-[#555370] md:flex-row">
          <span>
            Page {page} of {totalPages} · {total} users
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-[#e4e0f7] bg-white px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[#e4e0f7] bg-white px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            className="absolute inset-0"
            aria-hidden
            onClick={() => !createBusy && setShowCreate(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[#1c1b33]">Create user</h3>
            <p className="mt-1 text-sm text-[#777394]">
              Email must match your configured mail domain. Password must be at least 12 characters.
            </p>
            <form onSubmit={createUser} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-[#555370]">Full name</label>
                <input
                  required
                  value={createForm.fullName}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, fullName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#555370]">Email</label>
                <input
                  required
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#555370]">Password</label>
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#555370]">Plan</label>
                  <select
                    value={createForm.plan}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        plan: e.target.value as typeof createForm.plan,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm"
                  >
                    <option value="free">free</option>
                    <option value="business">business</option>
                    <option value="pro">pro</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#555370]">Account type</label>
                  <select
                    value={createForm.accountType}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        accountType: e.target.value as typeof createForm.accountType,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm"
                  >
                    <option value="personal">personal</option>
                    <option value="business">business</option>
                    <option value="professional">professional</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#555370]">Status</label>
                  <select
                    value={createForm.accountStatus}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        accountStatus: e.target.value as typeof createForm.accountStatus,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm"
                  >
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end gap-2">
                  <label className="flex items-center gap-2 text-sm text-[#1c1b33]">
                    <input
                      type="checkbox"
                      checked={createForm.emailVerified}
                      onChange={(e) =>
                        setCreateForm((f) => ({
                          ...f,
                          emailVerified: e.target.checked,
                        }))
                      }
                    />
                    Email verified
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[#1c1b33]">
                    <input
                      type="checkbox"
                      checked={createForm.isAdmin}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, isAdmin: e.target.checked }))
                      }
                    />
                    Admin access
                  </label>
                </div>
              </div>
              {createError && (
                <p className="text-sm text-red-700">{createError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={createBusy}
                  onClick={() => setShowCreate(false)}
                  className="rounded-xl px-4 py-2 text-sm text-[#555370] hover:bg-[#f4f2fb]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#5b3dff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {createBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[#1c1b33]">{confirm.title}</h3>
            <p className="mt-2 text-sm text-[#555370]">{confirm.detail}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="rounded-xl px-4 py-2 text-sm text-[#555370] hover:bg-[#f4f2fb]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirm.onConfirm()}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                  confirm.destructive
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[#5b3dff] hover:bg-[#4a32d6]"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-default bg-transparent"
          aria-label="Close menu"
          onClick={() => setMenuOpen(null)}
        />
      )}
    </div>
  );
}
