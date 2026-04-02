"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  LogOut,
  MailCheck,
  MailWarning,
  RefreshCw,
  Trash2,
  UserMinus,
  UserPlus,
  KeyRound,
  Pencil,
  StickyNote,
} from "lucide-react";

type DetailUser = {
  id: string;
  fullName: string;
  email: string;
  localPart: string;
  plan: string;
  accountType: string;
  status: string;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  suspensionReason: string | null;
  suspendedAt: string | null;
  adminNotes: string | null;
  passwordResetPending: boolean;
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

function fmt(iso: string | null): string {
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

export function AdminUserDetailPage({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<DetailUser | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    plan: "free" as "free" | "business" | "pro",
    accountType: "personal" as "personal" | "business" | "professional",
    accountStatus: "active" as "active" | "suspended" | "deleted",
    emailVerified: true,
    storageQuotaGb: 5,
    adminNotes: "",
    isAdmin: false,
  });
  const [confirm, setConfirm] = useState<{
    title: string;
    detail: string;
    destructive?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not load user");
      const u = data.user as DetailUser;
      setUser(u);
      setEditForm({
        fullName: u.fullName,
        email: u.email,
        plan: u.plan as typeof editForm.plan,
        accountType: u.accountType as typeof editForm.accountType,
        accountStatus:
          u.status === "deleted"
            ? "deleted"
            : u.status === "suspended"
              ? "suspended"
              : "active",
        emailVerified: u.emailVerified,
        storageQuotaGb: Math.max(1, Math.round(u.storageQuotaBytes / (1024 ** 3))),
        adminNotes: u.adminNotes ?? "",
        isAdmin: u.isAdmin,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(path: string, body?: object) {
    setBusy(path);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Request failed");
      if (data.warning) setError(String(data.warning));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    try {
      const storageQuotaBytes = Math.round(editForm.storageQuotaGb * 1024 ** 3);
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: editForm.fullName,
          email: editForm.email,
          plan: editForm.plan,
          accountType: editForm.accountType,
          accountStatus: editForm.accountStatus,
          emailVerified: editForm.emailVerified,
          storageQuotaBytes,
          adminNotes: editForm.adminNotes,
          isAdmin: editForm.isAdmin,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setUser(data.user);
      setShowEdit(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setBusy("note");
    try {
      const res = await fetch(`/api/admin/users/${userId}/notes`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: noteText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not add note");
      setNoteText("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Note failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading && !user) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-[#777394]">
        <Loader2 className="h-8 w-8 animate-spin text-[#5b3dff]" />
        <p className="text-sm">Loading profile…</p>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {error}
        <div className="mt-3">
          <Link href="/admin/users" className="text-[#5b3dff] underline">
            Back to users
          </Link>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 rounded-xl border border-[#e4e0f7] bg-white px-3 py-2 text-sm font-medium text-[#1c1b33] shadow-sm hover:bg-[#faf9ff]"
        >
          <ArrowLeft className="h-4 w-4" />
          Users
        </Link>
        <h2 className="text-xl font-semibold text-[#1c1b33]">{user.fullName}</h2>
        <span className="rounded-full bg-[#f0eefb] px-2.5 py-0.5 text-xs font-medium capitalize text-[#555370]">
          {user.status}
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {error}
          <button
            type="button"
            className="ml-3 text-amber-900 underline"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-[#ece9fb] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-[#1c1b33]">Profile</h3>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#777394]">
                  User ID
                </dt>
                <dd className="mt-1 font-mono text-xs text-[#1c1b33] break-all">{user.id}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#777394]">
                  Email
                </dt>
                <dd className="mt-1 text-[#1c1b33]">{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#777394]">
                  Plan
                </dt>
                <dd className="mt-1 capitalize text-[#1c1b33]">{user.plan}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#777394]">
                  Account type
                </dt>
                <dd className="mt-1 capitalize text-[#1c1b33]">{user.accountType}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#777394]">
                  Admin
                </dt>
                <dd className="mt-1 text-[#1c1b33]">{user.isAdmin ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#777394]">
                  Email verified
                </dt>
                <dd className="mt-1 text-[#1c1b33]">{user.emailVerified ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#777394]">
                  Created
                </dt>
                <dd className="mt-1 text-[#555370]">{fmt(user.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#777394]">
                  Updated
                </dt>
                <dd className="mt-1 text-[#555370]">{fmt(user.updatedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#777394]">
                  Last login
                </dt>
                <dd className="mt-1 text-[#555370]">{fmt(user.lastLoginAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[#777394]">
                  Storage
                </dt>
                <dd className="mt-1 text-[#1c1b33]">
                  {formatBytes(user.storageUsedBytes)} / {formatBytes(user.storageQuotaBytes)} used
                </dd>
              </div>
            </dl>
            {user.status === "suspended" && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-medium">Suspended</p>
                {user.suspendedAt && (
                  <p className="text-xs text-amber-900/90">Since {fmt(user.suspendedAt)}</p>
                )}
                {user.suspensionReason && (
                  <p className="mt-2 text-sm">{user.suspensionReason}</p>
                )}
              </div>
            )}
            {user.passwordResetPending && (
              <p className="mt-4 text-sm text-amber-800">
                A password reset link is active for this account.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[#ece9fb] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-[#1c1b33]">Internal notes</h3>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-[#faf9ff] p-4 text-sm text-[#555370]">
              {user.adminNotes?.trim() ? user.adminNotes : "No notes yet."}
            </pre>
            <form onSubmit={addNote} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add an internal note…"
                className="flex-1 rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy === "note"}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5b3dff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <StickyNote className="h-4 w-4" />
                Add note
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-[#ece9fb] bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#777394]">
              Actions
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowEdit(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e4e0f7] bg-white px-3 py-2 text-sm font-medium text-[#1c1b33] hover:bg-[#faf9ff]"
              >
                <Pencil className="h-4 w-4" />
                Edit user
              </button>
              {user.status === "active" ? (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => {
                    const reason =
                      typeof window !== "undefined"
                        ? window.prompt(
                            "Suspension reason (optional)",
                            ""
                          )?.trim() ?? ""
                        : "";
                    void post(`/api/admin/users/${userId}/suspend`, {
                      reason: reason || undefined,
                    });
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                >
                  <UserMinus className="h-4 w-4" />
                  Suspend
                </button>
              ) : user.status === "suspended" ? (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => post(`/api/admin/users/${userId}/unsuspend`)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  Unsuspend
                </button>
              ) : null}
              <button
                type="button"
                disabled={!!busy}
                onClick={() => post(`/api/admin/users/${userId}/verify-email`)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e4e0f7] bg-white px-3 py-2 text-sm hover:bg-[#faf9ff] disabled:opacity-50"
              >
                <MailCheck className="h-4 w-4" />
                Mark verified
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => post(`/api/admin/users/${userId}/unverify-email`)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e4e0f7] bg-white px-3 py-2 text-sm hover:bg-[#faf9ff] disabled:opacity-50"
              >
                <MailWarning className="h-4 w-4" />
                Mark unverified
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => post(`/api/admin/users/${userId}/resend-verification`)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e4e0f7] bg-white px-3 py-2 text-sm hover:bg-[#faf9ff] disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                Resend verification
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => post(`/api/admin/users/${userId}/reset-password`)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e4e0f7] bg-white px-3 py-2 text-sm hover:bg-[#faf9ff] disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" />
                Reset password
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => post(`/api/admin/users/${userId}/force-logout`)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e4e0f7] bg-white px-3 py-2 text-sm hover:bg-[#faf9ff] disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                Force logout
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() =>
                  setConfirm({
                    title: "Delete this user?",
                    detail: "Soft-delete: sessions revoked, login blocked.",
                    destructive: true,
                    onConfirm: async () => {
                      try {
                        const res = await fetch(`/api/admin/users/${userId}`, {
                          method: "DELETE",
                          credentials: "include",
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data.error ?? "Delete failed");
                        setConfirm(null);
                        router.push("/admin/users");
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Delete failed");
                        setConfirm(null);
                      }
                    },
                  })
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete user
              </button>
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            className="absolute inset-0"
            aria-hidden
            onClick={() => !busy && setShowEdit(false)}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[#1c1b33]">Edit user</h3>
            <form onSubmit={saveEdit} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-[#555370]">Full name</label>
                <input
                  required
                  value={editForm.fullName}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, fullName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#555370]">Email</label>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#555370]">Plan</label>
                  <select
                    value={editForm.plan}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        plan: e.target.value as typeof editForm.plan,
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
                    value={editForm.accountType}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        accountType: e.target.value as typeof editForm.accountType,
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
              <div>
                <label className="text-xs font-medium text-[#555370]">Account status</label>
                <select
                  value={editForm.accountStatus}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      accountStatus: e.target.value as typeof editForm.accountStatus,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm"
                >
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                  <option value="deleted">deleted</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.emailVerified}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, emailVerified: e.target.checked }))
                  }
                />
                Email verified
              </label>
              <div>
                <label className="text-xs font-medium text-[#555370]">
                  Storage quota (GiB)
                </label>
                <input
                  type="number"
                  min={1}
                  max={1024}
                  value={editForm.storageQuotaGb}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      storageQuotaGb: Number(e.target.value) || 1,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#555370]">Notes (replace)</label>
                <textarea
                  value={editForm.adminNotes}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, adminNotes: e.target.value }))
                  }
                  rows={5}
                  className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.isAdmin}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, isAdmin: e.target.checked }))
                  }
                />
                Admin access
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="rounded-xl px-4 py-2 text-sm text-[#555370] hover:bg-[#f4f2fb]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy === "save"}
                  className="rounded-xl bg-[#5b3dff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === "save" ? "Saving…" : "Save changes"}
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
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
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
