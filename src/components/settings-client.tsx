"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { applyMailTheme } from "@/components/theme-provider";
import { BusinessSettingsPanel } from "@/components/business-settings-panel";
import { ProfessionalSettingsPanel } from "@/components/professional-settings-panel";

type SectionId =
  | "account"
  | "security"
  | "appearance"
  | "inbox"
  | "compose"
  | "labels"
  | "filters"
  | "automation"
  | "privacy"
  | "notifications"
  | "storage"
  | "subscription"
  | "business"
  | "professional";

type SettingsRow = {
  userId: string;
  theme: string;
  accentHex: string;
  conversationView: boolean;
  unreadFirst: boolean;
  inboxDensity: string;
  signatureHtml: string;
  composeFont: string;
  draftAutoSave: boolean;
  blockTrackers: boolean;
  readReceiptsOutgoing: boolean;
  externalImages: string;
  notificationsEnabled: boolean;
  updatedAt: string;
};

type SessionRow = {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  userAgent: string | null;
  ipHint: string | null;
  isCurrent: boolean;
};

type BillingInfo = {
  plan: string;
  planStatus: string;
  planExpiresAt: string | null;
  hasSubscription: boolean;
  razorpayPlanId: string | null;
  nextBillingAt: string | null;
  subscriptionAutoRenew: boolean;
  proPlanStatus: string;
  proPlanExpiresAt: string | null;
  hasProSubscription: boolean;
  proRazorpayPlanId: string | null;
  proNextBillingAt: string | null;
  proSubscriptionAutoRenew: boolean;
};

type Overview = {
  user: {
    id: string;
    email: string;
    avatarUrl: string | null;
    lastLoginAt: string | null;
    createdAt: string;
  };
  settings: SettingsRow;
  sessions: SessionRow[];
  labels: { id: string; name: string; color: string | null; createdAt: string }[];
  blocked: { id: string; email: string; createdAt: string }[];
  rules: {
    id: string;
    fromMatch: string;
    action: string;
    labelId: string | null;
    createdAt: string;
  }[];
  storage: {
    bytesUsed: number;
    messageCount: number;
    attachmentBytes: number;
    approxBodyBytes: number;
    limitBytes: number;
    remainingBytes: number;
    effectivePlan: "free" | "business";
    breakdown: {
      mailboxContentBytes: number;
      mailboxAttachmentBytes: number;
      composeDraftBytes: number;
      composeAttachmentBytes: number;
      scheduledPendingBytes: number;
      confidentialBytes: number;
      tempInboxBytes: number;
    };
    usageLevel: "ok" | "warning80" | "warning95" | "full";
    usageRatio: number;
    usageMessage: string | null;
  };
  billing: BillingInfo;
};

type LinkedAccount = {
  userId: string;
  email: string;
  avatarUrl: string | null;
  isCurrent: boolean;
};

const navItems: { id: SectionId; label: string; hint?: string }[] = [
  { id: "account", label: "Account" },
  { id: "security", label: "Security" },
  { id: "appearance", label: "Appearance" },
  { id: "inbox", label: "Inbox" },
  { id: "compose", label: "Compose" },
  { id: "labels", label: "Labels" },
  { id: "filters", label: "Block & filters" },
  { id: "automation", label: "Automation & team" },
  { id: "privacy", label: "Privacy" },
  { id: "notifications", label: "Notifications" },
  { id: "storage", label: "Storage" },
  { id: "subscription", label: "Subscription" },
];

type TempInboxSubscriptionState = {
  active: boolean;
  activationDate: string | null;
  expiryDate: string | null;
};

function formatBytes(n: number): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "0 B";
  const KB = 1024;
  const MB = 1024 * KB;
  const GB = 1024 * MB;
  const TB = 1024 * GB;
  if (v < KB) return `${Math.round(v)} B`;
  if (v < MB) return `${(v / KB).toFixed(1)} KB`;
  if (v < GB) return `${(v / MB).toFixed(2)} MB`;
  if (v < TB) return `${(v / GB).toFixed(2)} GB`;
  return `${(v / TB).toFixed(2)} TB`;
}

function deviceLabel(ua: string | null): string {
  if (!ua) return "Unknown device";
  if (/Mobile|Android|iPhone/i.test(ua)) return "Mobile / tablet";
  return "Desktop browser";
}

function passkeyFriendlyError(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "name" in err) {
    const name = String((err as { name?: string }).name ?? "");
    if (name === "NotAllowedError" || name === "AbortError") {
      return "Passkey request was cancelled. You can continue with password sign-in.";
    }
    if (name === "NotSupportedError") {
      return "Passkeys are not supported on this browser/device.";
    }
  }
  return fallback;
}

export function SettingsClient({
  email,
  initialSection,
}: {
  email: string;
  initialSection?: SectionId;
}) {
  const router = useRouter();
  const [section, setSection] = useState<SectionId>(initialSection ?? "account");
  const [data, setData] = useState<Overview | null>(null);
  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tempInboxSubscription, setTempInboxSubscription] =
    useState<TempInboxSubscriptionState>({
      active: false,
      activationDate: null,
      expiryDate: null,
    });

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2800);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings", { credentials: "include" });
    if (!res.ok) {
      router.push("/login");
      return;
    }
    const j = (await res.json()) as Overview;
    setData(j);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/temp-inbox/current", {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) {
            setTempInboxSubscription({
              active: false,
              activationDate: null,
              expiryDate: null,
            });
          }
          return;
        }
        const payload = (await res.json()) as {
          alias?: { expiresAt?: string; expiryMinutes?: number } | null;
        };
        const alias = payload.alias ?? null;
        const expiryDate = alias?.expiresAt ?? null;
        let activationDate: string | null = null;
        if (alias?.expiresAt && Number.isFinite(alias.expiryMinutes)) {
          const exp = new Date(alias.expiresAt).getTime();
          const startMs = exp - Number(alias.expiryMinutes) * 60 * 1000;
          if (Number.isFinite(startMs)) activationDate = new Date(startMs).toISOString();
        }
        if (!cancelled) {
          setTempInboxSubscription({
            active: true,
            activationDate,
            expiryDate,
          });
        }
      } catch {
        if (!cancelled) {
          setTempInboxSubscription({
            active: false,
            activationDate: null,
            expiryDate: null,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const patchSettings = async (
    partial: Record<string, string | boolean>,
    msg = "Saved"
  ) => {
    setErr("");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(partial),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr((j as { error?: string }).error ?? "Could not save");
      return;
    }
    showToast(msg);
    const next = (j as { settings?: SettingsRow }).settings;
    if (next) {
      setData((d) => (d ? { ...d, settings: next } : d));
      applyMailTheme(next.theme, next.accentHex);
    } else {
      await load();
    }
  };

  if (!data) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--background)] text-[var(--muted)]">
        Loading settings…
      </div>
    );
  }

  const s = data.settings;
  // eslint-disable-next-line react-hooks/purity -- computed on render for simple gating
  const nowMs = Date.now();
  const hasBusiness =
    data.billing.plan === "business" &&
    (!data.billing.planExpiresAt ||
      new Date(data.billing.planExpiresAt).getTime() > nowMs);
  const navRows = [
    ...navItems,
    ...(hasBusiness ? [{ id: "business" as const, label: "Business Email" }] : []),
  ];

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-[var(--foreground)] px-5 py-2 text-sm text-[var(--background)] shadow-lg transition">
          {toast}
        </div>
      )}
      <header className="border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 overflow-hidden rounded-full border border-[var(--border)] bg-slate-100 text-xs font-semibold text-[var(--muted)]">
              {data.user.avatarUrl ? (
                <img src={data.user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  {(email[0] ?? "?").toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-lg font-semibold">Settings</h1>
              <p className="text-xs text-[var(--muted)]">{email}</p>
            </div>
          </div>
          <Link
            href="/inbox"
            className="text-sm font-medium text-[var(--accent)] hover:underline"
          >
            Back to inbox
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:items-start">
        <nav className="flex w-full shrink-0 flex-wrap gap-1 md:w-52 md:flex-col md:gap-0">
          {navRows.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
                setErr("");
              }}
              className={`rounded-lg px-3 py-2 text-left text-sm font-medium md:w-full ${
                section === item.id
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--foreground)] hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main className="min-w-0 flex-1 space-y-8">
          {err && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              {err}
            </p>
          )}

          {section === "account" && (
            <AccountPanel
              userId={data.user.id}
              email={email}
              avatarUrl={data.user.avatarUrl}
              showToast={showToast}
              onAvatarChange={(avatar) =>
                setData((prev) =>
                  prev ? { ...prev, user: { ...prev.user, avatarUrl: avatar } } : prev
                )
              }
            />
          )}
          {section === "security" && (
            <SecurityPanel
              data={data}
              showToast={showToast}
              setErr={setErr}
              onReload={load}
              busy={busy}
              setBusy={setBusy}
            />
          )}
          {section === "appearance" && (
            <AppearancePanel settings={s} patchSettings={patchSettings} />
          )}
          {section === "inbox" && (
            <InboxPanel settings={s} patchSettings={patchSettings} />
          )}
          {section === "compose" && (
            <ComposePanel settings={s} patchSettings={patchSettings} />
          )}
          {section === "labels" && (
            <LabelsPanel labels={data.labels} onReload={load} showToast={showToast} setErr={setErr} />
          )}
          {section === "filters" && (
            <FiltersPanel
              blocked={data.blocked}
              rules={data.rules}
              labels={data.labels}
              onReload={load}
              showToast={showToast}
              setErr={setErr}
            />
          )}
          {section === "automation" && (
            <AutomationPanel
              labels={data.labels}
              showToast={showToast}
              setErr={setErr}
            />
          )}
          {section === "privacy" && (
            <PrivacyPanel settings={s} patchSettings={patchSettings} />
          )}
          {section === "notifications" && (
            <NotificationsPanel settings={s} patchSettings={patchSettings} />
          )}
          {section === "storage" && (
            <StoragePanel
              storage={data.storage}
              showToast={showToast}
              setErr={setErr}
              onReload={load}
            />
          )}
          {section === "subscription" && (
            <SubscriptionPanel
              billing={data.billing}
              userCreatedAt={data.user.createdAt}
              tempInbox={tempInboxSubscription}
              showToast={showToast}
              setErr={setErr}
              onReload={load}
            />
          )}

          {section === "business" && (
            <BusinessSettingsPanel
              isBusiness={hasBusiness}
              showToast={showToast}
              setErr={setErr}
            />
          )}
          {section === "professional" && (
            <ProfessionalSettingsPanel
              billing={data.billing}
              showToast={showToast}
              setErr={setErr}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      )}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function AccountPanel({
  userId,
  email,
  avatarUrl,
  showToast,
  onAvatarChange,
}: {
  userId: string;
  email: string;
  avatarUrl: string | null;
  showToast: (s: string) => void;
  onAvatarChange: (avatarUrl: string | null) => void;
}) {
  const router = useRouter();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [delEmail, setDelEmail] = useState("");
  const [delPass, setDelPass] = useState("");
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [addUsername, setAddUsername] = useState("");
  const [addPassword, setAddPassword] = useState("");

  const loadLinkedAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    const res = await fetch("/api/auth/accounts", { credentials: "include" });
    const j = await res.json().catch(() => ({}));
    setLoadingAccounts(false);
    if (!res.ok) return;
    setAccounts((j as { accounts?: LinkedAccount[] }).accounts ?? []);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadLinkedAccounts);
  }, [loadLinkedAccounts]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (next !== next2) {
      showToast("New passwords do not match");
      return;
    }
    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ currentPassword: cur, newPassword: next }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((j as { error?: string }).error ?? "Failed");
      return;
    }
    setCur("");
    setNext("");
    setNext2("");
    showToast("Password updated");
  }

  async function logoutEverywhere() {
    if (!confirm("Sign out from all devices including this one?")) return;
    await fetch("/api/settings/sessions/revoke-all", {
      method: "POST",
      credentials: "include",
    });
    router.push("/");
    router.refresh();
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm("Permanently delete your account and all mail?")) return;
    const res = await fetch("/api/settings/account", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        password: delPass,
        confirmEmail: delEmail,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((j as { error?: string }).error ?? "Could not delete");
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function uploadAvatar(file: File) {
    const form = new FormData();
    form.set("avatar", file);
    const res = await fetch("/api/settings/avatar", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((j as { error?: string }).error ?? "Could not upload profile photo");
      return;
    }
    const next = (j as { avatarUrl?: string | null }).avatarUrl ?? null;
    onAvatarChange(next);
    showToast("Profile photo updated");
    await loadLinkedAccounts();
  }

  async function removeAvatar() {
    const res = await fetch("/api/settings/avatar", {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      showToast("Could not remove profile photo");
      return;
    }
    onAvatarChange(null);
    showToast("Profile photo removed");
    await loadLinkedAccounts();
  }

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: addUsername, password: addPassword }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((j as { error?: string }).error ?? "Could not add account");
      return;
    }
    setAddUsername("");
    setAddPassword("");
    showToast("Account added and switched");
    await loadLinkedAccounts();
    router.refresh();
  }

  async function switchAccount(targetUserId: string) {
    const res = await fetch("/api/auth/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId: targetUserId }),
    });
    if (!res.ok) {
      showToast("Could not switch account");
      return;
    }
    showToast("Switched account");
    router.refresh();
  }

  async function removeLinkedAccount(targetUserId: string) {
    const res = await fetch("/api/auth/accounts", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId: targetUserId }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast((j as { error?: string }).error ?? "Could not remove account");
      return;
    }
    showToast("Account removed from this browser");
    await loadLinkedAccounts();
  }

  return (
    <>
      <Panel
        title="Profile photo"
        description="Upload a profile picture used for your account identity in Sendora."
      >
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 overflow-hidden rounded-full border border-[var(--border)] bg-slate-100 text-lg font-semibold text-[var(--muted)]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                {(email[0] ?? "?").toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white">
              Upload / Change
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadAvatar(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            {avatarUrl && (
              <button
                type="button"
                onClick={removeAvatar}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        title="Multiple accounts"
        description="Add another account, switch between accounts, and remove linked accounts from this browser."
      >
        <form onSubmit={addAccount} className="max-w-md space-y-3">
          <input
            className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            placeholder="Username"
            value={addUsername}
            onChange={(e) => setAddUsername(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            placeholder="Password"
            value={addPassword}
            onChange={(e) => setAddPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Add account
          </button>
        </form>
        <div className="rounded-xl border border-[var(--border)]">
          {loadingAccounts ? (
            <p className="px-3 py-2 text-sm text-[var(--muted)]">Loading accounts…</p>
          ) : accounts.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[var(--muted)]">No linked accounts yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {accounts.map((acc) => (
                <li key={acc.userId} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="h-7 w-7 overflow-hidden rounded-full border border-[var(--border)] bg-slate-100 text-[10px] font-semibold text-[var(--muted)]">
                      {acc.avatarUrl ? (
                        <img src={acc.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          {(acc.email[0] ?? "?").toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{acc.email}</p>
                      {acc.isCurrent && <p className="text-xs text-[var(--muted)]">Current account</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!acc.isCurrent && (
                      <button
                        type="button"
                        onClick={() => void switchAccount(acc.userId)}
                        className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium hover:bg-slate-50 dark:hover:bg-white/5"
                      >
                        Switch
                      </button>
                    )}
                    {acc.userId !== userId && (
                      <button
                        type="button"
                        onClick={() => void removeLinkedAccount(acc.userId)}
                        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Panel
        title="Password"
        description="Use a unique passphrase you do not reuse elsewhere."
      >
        <form onSubmit={changePassword} className="max-w-md space-y-3">
          <input
            type="password"
            className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            placeholder="Current password"
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            placeholder="New password (12+ characters)"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={12}
          />
          <input
            type="password"
            className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            placeholder="Confirm new password"
            value={next2}
            onChange={(e) => setNext2(e.target.value)}
            required
            minLength={12}
          />
          <button
            type="submit"
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Update password
          </button>
        </form>
      </Panel>

      <Panel title="Sessions" description="Control where you stay signed in.">
        <button
          type="button"
          onClick={logoutEverywhere}
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5"
        >
          Log out all devices
        </button>
      </Panel>

      <Panel
        title="Delete account"
        description={`Type your full address (${email}) and your password. This cannot be undone.`}
      >
        <form onSubmit={deleteAccount} className="max-w-md space-y-3">
          <input
            className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            placeholder="Confirm email address"
            value={delEmail}
            onChange={(e) => setDelEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            placeholder="Password"
            value={delPass}
            onChange={(e) => setDelPass(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200"
          >
            Delete my account
          </button>
        </form>
      </Panel>
    </>
  );
}

function SecurityPanel({
  data,
  showToast,
  setErr,
  onReload,
  busy,
  setBusy,
}: {
  data: Overview;
  showToast: (s: string) => void;
  setErr: (s: string) => void;
  onReload: () => Promise<void>;
  busy: boolean;
  setBusy: (b: boolean) => void;
}) {
  const [recoveryPass, setRecoveryPass] = useState("");
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyCount, setPasskeyCount] = useState<number | null>(null);
  const [supportBusy, setSupportBusy] = useState(false);

  async function regen(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/settings/recovery-key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password: recoveryPass }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr((j as { error?: string }).error ?? "Failed");
      return;
    }
    setShownKey((j as { recoveryKey?: string }).recoveryKey ?? null);
    setRecoveryPass("");
    showToast("New recovery key generated");
  }

  async function revokeOthers() {
    setBusy(true);
    await fetch("/api/settings/sessions/revoke-others", {
      method: "POST",
      credentials: "include",
    });
    setBusy(false);
    showToast("Other sessions signed out");
    await onReload();
  }

  async function revokeOne(id: string) {
    await fetch(`/api/settings/sessions/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    showToast("Session ended");
    await onReload();
  }

  async function loadPasskeys() {
    try {
      const res = await fetch("/api/settings/passkeys", { credentials: "include" });
      const j = (await res.json().catch(() => ({}))) as unknown;
      if (!res.ok) return;
      const count =
        typeof j === "object" &&
        j !== null &&
        Array.isArray((j as { passkeys?: unknown }).passkeys)
          ? (j as { passkeys: unknown[] }).passkeys.length
          : 0;
      setPasskeyCount(count);
    } catch {
      // Ignore.
    }
  }

  async function addPasskey() {
    setErr("");
    setPasskeyBusy(true);
    try {
      if (typeof window === "undefined" || typeof PublicKeyCredential === "undefined") {
        setErr("Passkeys are not supported on this device/browser.");
        return;
      }
      const { startRegistration } = await import("@simplewebauthn/browser");
      const optRes = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const optJson = (await optRes.json().catch(() => ({}))) as unknown;
      const options =
        typeof optJson === "object" && optJson !== null
          ? (optJson as { options?: unknown }).options
          : undefined;
      const errMsg =
        typeof optJson === "object" && optJson !== null
          ? (optJson as { error?: string }).error
          : undefined;
      if (!optRes.ok || !options) {
        setErr(errMsg ?? "Could not start passkey setup.");
        return;
      }
      const regResp = await startRegistration({
        optionsJSON: options as PublicKeyCredentialCreationOptionsJSON,
      });
      const verifyRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response: regResp }),
      });
      const verifyJson = (await verifyRes.json().catch(() => ({}))) as unknown;
      if (!verifyRes.ok) {
        setErr(
          typeof verifyJson === "object" && verifyJson !== null
            ? ((verifyJson as { error?: string }).error ?? "Passkey setup failed.")
            : "Passkey setup failed."
        );
        return;
      }
      showToast("Passkey added");
      await loadPasskeys();
    } catch (err) {
      setErr(passkeyFriendlyError(err, "Passkey setup failed. Please try again."));
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function removeAllPasskeys() {
    if (!confirm("Remove all passkeys? You can still sign in with your password and backup recovery.")) {
      return;
    }
    setErr("");
    setPasskeyBusy(true);
    try {
      const res = await fetch("/api/settings/passkeys", {
        method: "DELETE",
        credentials: "include",
      });
      const j = (await res.json().catch(() => ({}))) as unknown;
      if (!res.ok) {
        setErr(
          typeof j === "object" && j !== null
            ? ((j as { error?: string }).error ?? "Could not remove passkeys.")
            : "Could not remove passkeys."
        );
        return;
      }
      showToast("Passkeys removed");
      await loadPasskeys();
    } catch {
      setErr("Could not remove passkeys.");
    } finally {
      setPasskeyBusy(false);
    }
  }

  function downloadBackupFromShownKey() {
    if (!shownKey) return;
    const localPart = (data.user.email.split("@")[0] ?? "account").toLowerCase();
    const backup = {
      type: "sendora_backup",
      version: 1,
      username: localPart,
      recoveryKey: shownKey,
      createdAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sendora-backup-${localPart}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Backup file downloaded");
  }

  async function contactSupport() {
    setSupportBusy(true);
    setErr("");
    try {
      const username = (data.user.email.split("@")[0] ?? "").toLowerCase();
      const res = await fetch("/api/auth/recovery/support-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username,
          source: "settings_security",
          hasBackupFile: Boolean(shownKey),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Could not send support request. Please try again shortly.");
        return;
      }
      showToast("Support request sent");
    } finally {
      setSupportBusy(false);
    }
  }

  useEffect(() => {
    void loadPasskeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Panel
        title="Recovery & sign-in methods"
        description="Manage your fallback options so you can always regain access."
      >
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2">
            <span>Password login</span>
            <span className="font-medium text-emerald-600">Available</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2">
            <span>Backup file recovery</span>
            <span className="font-medium text-emerald-600">Ready</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2">
            <span>Passkey sign-in</span>
            <span className="font-medium">
              {passkeyCount === null
                ? "Checking…"
                : passkeyCount > 0
                  ? `Enabled (${passkeyCount})`
                  : "Not enabled"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={addPasskey}
            disabled={busy || passkeyBusy}
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {passkeyBusy ? "Working…" : passkeyCount && passkeyCount > 0 ? "Add or replace passkey" : "Add passkey"}
          </button>
          <button
            type="button"
            onClick={contactSupport}
            disabled={supportBusy}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
          >
            {supportBusy ? "Sending…" : "Contact support"}
          </button>
          <Link
            href="/forgot-password"
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5"
          >
            Test recovery flow
          </Link>
        </div>
      </Panel>

      <Panel
        title="Sign-in activity"
        description="We cannot show true IP addresses in all environments; device hints help you recognize sessions."
      >
        <p className="text-sm text-[var(--muted)]">
          Last sign-in:{" "}
          <span className="text-[var(--foreground)]">
            {data.user.lastLoginAt
              ? new Date(data.user.lastLoginAt).toLocaleString()
              : "—"}
          </span>
        </p>
        <p className="text-sm text-[var(--muted)]">
          Member since:{" "}
          {new Date(data.user.createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={revokeOthers}
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Log out other devices
        </button>
        <ul className="mt-4 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
          {data.sessions.map((sess) => (
            <li
              key={sess.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {deviceLabel(sess.userAgent)}
                  {sess.isCurrent && (
                    <span className="ml-2 text-xs text-[var(--accent)]">
                      This device
                    </span>
                  )}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  Last active:{" "}
                  {sess.lastUsedAt
                    ? new Date(sess.lastUsedAt).toLocaleString()
                    : new Date(sess.createdAt).toLocaleString()}
                  {sess.ipHint ? ` · ${sess.ipHint}` : ""}
                </p>
              </div>
              {!sess.isCurrent && (
                <button
                  type="button"
                  onClick={() => revokeOne(sess.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Recovery key"
        description="The server never stores your original key. Regenerate sets a new key and invalidates the old one."
      >
        <div className="max-w-md text-sm text-[var(--muted)]">
          Your recovery key is used to verify a backup file during{" "}
          <span className="font-medium text-[var(--text)]">Forgot Password</span>. If you
          ever lose your backup file, generate a new recovery key and download a fresh
          backup file.
        </div>
        <form onSubmit={regen} className="max-w-md space-y-3">
          <input
            type="password"
            className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            placeholder="Confirm password"
            value={recoveryPass}
            onChange={(e) => setRecoveryPass(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
          >
            Generate new recovery key
          </button>
        </form>
        {shownKey && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-950/30">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              Save this key once — it will not be shown again.
            </p>
            <code className="mt-2 block break-all font-mono text-xs">
              {shownKey}
            </code>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadBackupFromShownKey}
                className="rounded-full border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900/30"
              >
                Download new backup file
              </button>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title="Passkeys"
        description="Passkeys let you sign in using your device security (Face ID / fingerprint / PIN). Optional and can be removed anytime."
      >
        <div className="max-w-md space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Status:{" "}
            <span className="text-[var(--foreground)]">
              {passkeyCount === null
                ? "Checking…"
                : passkeyCount > 0
                  ? `Enabled (${passkeyCount})`
                  : "Not set up"}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addPasskey}
              disabled={busy || passkeyBusy}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {passkeyBusy ? "Working…" : "Add passkey"}
            </button>
            <button
              type="button"
              onClick={removeAllPasskeys}
              disabled={busy || passkeyBusy || !passkeyCount}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
            >
              Remove passkeys
            </button>
          </div>
          <p className="text-xs text-[var(--muted)]">
            If passkey sign-in fails, use your password. If password is unavailable, recover with your backup file.
          </p>
        </div>
      </Panel>
    </>
  );
}

function AppearancePanel({
  settings,
  patchSettings,
}: {
  settings: SettingsRow;
  patchSettings: (
    p: Record<string, string | boolean>,
    msg?: string
  ) => Promise<void>;
}) {
  return (
    <Panel title="Theme" description="Sync with your system or pick a fixed mode.">
      <div className="flex flex-wrap gap-2">
        {(["light", "dark", "system"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => patchSettings({ theme: t }, "Theme updated")}
            className={`rounded-full px-4 py-2 text-sm font-medium capitalize ${
              settings.theme === t
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border border-[var(--border)] hover:bg-slate-50 dark:hover:bg-white/5"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-4 max-w-xs">
        <label className="text-xs font-medium text-[var(--muted)]">Accent</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="color"
            value={settings.accentHex}
            onChange={(e) =>
              patchSettings({ accentHex: e.target.value }, "Accent updated")
            }
            className="h-10 w-14 cursor-pointer rounded border border-[var(--border)] bg-transparent"
          />
          <span className="text-sm">{settings.accentHex}</span>
        </div>
      </div>
    </Panel>
  );
}

function InboxPanel({
  settings,
  patchSettings,
}: {
  settings: SettingsRow;
  patchSettings: (
    p: Record<string, string | boolean>,
    msg?: string
  ) => Promise<void>;
}) {
  return (
    <Panel title="Reading" description="Tune how threads and density feel in the inbox.">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.conversationView}
          onChange={(e) =>
            patchSettings({ conversationView: e.target.checked })
          }
        />
        Conversation view (threads)
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.unreadFirst}
          onChange={(e) => patchSettings({ unreadFirst: e.target.checked })}
        />
        Show unread first (inbox)
      </label>
      <div>
        <p className="text-xs font-medium text-[var(--muted)]">Density</p>
        <div className="mt-1 flex gap-2">
          {(["comfortable", "compact"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => patchSettings({ inboxDensity: d })}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
                settings.inboxDensity === d
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border border-[var(--border)]"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function ComposePanel({
  settings,
  patchSettings,
}: {
  settings: SettingsRow;
  patchSettings: (
    p: Record<string, string | boolean>,
    msg?: string
  ) => Promise<void>;
}) {
  const [sig, setSig] = useState(settings.signatureHtml);

  useEffect(() => {
    void Promise.resolve().then(() => setSig(settings.signatureHtml));
  }, [settings.signatureHtml]);

  return (
    <Panel
      title="Compose"
      description="Signatures are appended to outgoing mail as HTML. Keep markup simple."
    >
      <label className="text-xs font-medium text-[var(--muted)]">Signature</label>
      <textarea
        className="mt-1 min-h-[100px] w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
        value={sig}
        onChange={(e) => setSig(e.target.value)}
        onBlur={() => {
          if (sig !== settings.signatureHtml) {
            void patchSettings({ signatureHtml: sig });
          }
        }}
      />
      <div>
        <p className="text-xs font-medium text-[var(--muted)]">Default font</p>
        <select
          className="mt-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          value={settings.composeFont}
          onChange={(e) =>
            patchSettings({ composeFont: e.target.value }, "Saved")
          }
        >
          <option value="system">System</option>
          <option value="sans">Sans</option>
          <option value="serif">Serif</option>
          <option value="mono">Mono</option>
        </select>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.draftAutoSave}
          onChange={(e) => patchSettings({ draftAutoSave: e.target.checked })}
        />
        Auto-save drafts while composing
      </label>
    </Panel>
  );
}

function LabelsPanel({
  labels,
  onReload,
  showToast,
  setErr,
}: {
  labels: Overview["labels"];
  onReload: () => Promise<void>;
  showToast: (s: string) => void;
  setErr: (s: string) => void;
}) {
  const [name, setName] = useState("");
  const [edits, setEdits] = useState<Record<string, { name: string; color: string }>>({});

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/mail/labels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr((j as { error?: string }).error ?? "Failed");
      return;
    }
    setName("");
    showToast("Label created");
    await onReload();
  }

  function startEdit(l: (typeof labels)[0]) {
    setEdits((e) => ({
      ...e,
      [l.id]: {
        name: l.name,
        color: l.color ?? "#5b4dff",
      },
    }));
  }

  async function saveEdit(id: string) {
    const e = edits[id];
    if (!e) return;
    const res = await fetch(`/api/mail/labels/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: e.name, color: e.color }),
    });
    if (!res.ok) {
      showToast("Could not save label");
      return;
    }
    setEdits((x) => {
      const n = { ...x };
      delete n[id];
      return n;
    });
    showToast("Label updated");
    await onReload();
  }

  async function remove(id: string) {
    if (!confirm("Remove label from all mail?")) return;
    await fetch(`/api/mail/labels/${id}`, { method: "DELETE", credentials: "include" });
    showToast("Label deleted");
    await onReload();
  }

  return (
    <Panel title="Labels" description="Create, color, rename, and remove labels.">
      <form onSubmit={create} className="flex flex-wrap gap-2">
        <input
          className="min-w-[200px] flex-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          placeholder="New label name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        >
          Add
        </button>
      </form>
      <ul className="mt-4 space-y-2">
        {labels.map((l) => {
          const ed = edits[l.id];
          return (
            <li
              key={l.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2"
            >
              {ed ? (
                <>
                  <input
                    className="rounded border border-[var(--border)] bg-transparent px-2 py-1 text-sm"
                    value={ed.name}
                    onChange={(e) =>
                      setEdits((x) => ({
                        ...x,
                        [l.id]: { ...ed, name: e.target.value },
                      }))
                    }
                  />
                  <input
                    type="color"
                    value={ed.color}
                    onChange={(e) =>
                      setEdits((x) => ({
                        ...x,
                        [l.id]: { ...ed, color: e.target.value },
                      }))
                    }
                    className="h-8 w-12 cursor-pointer rounded border"
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit(l.id)}
                    className="text-sm text-[var(--accent)]"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEdits((x) => {
                        const n = { ...x };
                        delete n[l.id];
                        return n;
                      })
                    }
                    className="text-sm text-[var(--muted)]"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: l.color ?? "#94a3b8" }}
                  />
                  <span className="flex-1 text-sm font-medium">{l.name}</span>
                  <button
                    type="button"
                    onClick={() => startEdit(l)}
                    className="text-sm text-[var(--accent)]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(l.id)}
                    className="text-sm text-red-600"
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

type AutomationRuleRow = {
  id: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
  conditions: unknown;
  actions: unknown;
};

function AutomationPanel({
  labels,
  showToast,
  setErr,
}: {
  labels: Overview["labels"];
  showToast: (s: string) => void;
  setErr: (s: string) => void;
}) {
  const [rules, setRules] = useState<AutomationRuleRow[]>([]);
  const [workflows, setWorkflows] = useState<
    { id: string; name: string; enabled: boolean }[]
  >([]);
  const [contacts, setContacts] = useState<{ id: string; pattern: string }[]>(
    []
  );
  const [workspaceList, setWorkspaceList] = useState<
    { id: string; name: string; role: string; inboxOwnerUserId: string }[]
  >([]);
  const [ruleName, setRuleName] = useState("Invoice routing");
  const [subjectHas, setSubjectHas] = useState("invoice");
  const [folder, setFolder] = useState<"inbox" | "archive" | "spam">("archive");
  const [ruleLabelId, setRuleLabelId] = useState("");

  const loadAll = useCallback(async () => {
    const [r, w, c, ws] = await Promise.all([
      fetch("/api/automation/rules", { credentials: "include" }).then((x) =>
        x.json().catch(() => ({}))
      ),
      fetch("/api/automation/workflows", { credentials: "include" }).then(
        (x) => x.json().catch(() => ({}))
      ),
      fetch("/api/important-contacts", { credentials: "include" }).then(
        (x) => x.json().catch(() => ({}))
      ),
      fetch("/api/workspaces", { credentials: "include" }).then((x) =>
        x.json().catch(() => ({}))
      ),
    ]);
    setRules((r as { rules?: AutomationRuleRow[] }).rules ?? []);
    setWorkflows(
      ((w as { workflows?: { id: string; name: string; enabled: boolean }[] })
        .workflows ?? []).map((x) => ({
        id: x.id,
        name: x.name,
        enabled: x.enabled,
      }))
    );
    setContacts((c as { contacts?: { id: string; pattern: string }[] }).contacts ?? []);
    setWorkspaceList(
      (ws as { workspaces?: typeof workspaceList }).workspaces ?? []
    );
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function addQuickRule(e: React.FormEvent) {
    e.preventDefault();
    const conditions = [
      {
        kind: "subject" as const,
        op: "contains" as const,
        value: subjectHas.trim(),
      },
    ];
    const actions: unknown[] = [{ type: "move_folder", folder }];
    if (ruleLabelId) {
      actions.push({ type: "apply_label", labelId: ruleLabelId });
    }
    const res = await fetch("/api/automation/rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: ruleName.trim(),
        conditions,
        actions,
        sortOrder: 0,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr((j as { error?: string }).error ?? "Could not save rule");
      return;
    }
    showToast("Automation rule saved");
    await loadAll();
  }

  async function deleteRule(id: string) {
    await fetch(`/api/automation/rules/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    showToast("Rule removed");
    await loadAll();
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const pattern = String(fd.get("pattern") ?? "").trim();
    if (!pattern) return;
    const res = await fetch("/api/important-contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pattern }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr((j as { error?: string }).error ?? "Failed");
      return;
    }
    showToast("Important contact added");
    (e.target as HTMLFormElement).reset();
    await loadAll();
  }

  async function removeContact(id: string) {
    await fetch(`/api/important-contacts/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    showToast("Removed");
    await loadAll();
  }

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const name = String(fd.get("wsname") ?? "").trim() || "Team inbox";
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr((j as { error?: string }).error ?? "Failed");
      return;
    }
    showToast("Workspace created — add members from the API or a future UI panel.");
    await loadAll();
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Email automation rules"
        description="Rules run on every new inbound message after it is saved. Combine with Block & filters for trash routing."
      >
        <form onSubmit={addQuickRule} className="space-y-3 rounded-xl border border-[var(--border)] p-4">
          <p className="text-sm text-[var(--muted)]">
            Quick builder: subject contains → move to folder (optional label).
          </p>
          <input
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="Rule name"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="Subject contains (e.g. invoice)"
            value={subjectHas}
            onChange={(e) => setSubjectHas(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <select
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={folder}
              onChange={(e) => setFolder(e.target.value as typeof folder)}
            >
              <option value="inbox">Move to Inbox</option>
              <option value="archive">Move to Archive</option>
              <option value="spam">Move to Spam</option>
            </select>
            <select
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={ruleLabelId}
              onChange={(e) => setRuleLabelId(e.target.value)}
            >
              <option value="">No label</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Add rule
            </button>
          </div>
        </form>
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
          {rules.length === 0 && (
            <li className="p-4 text-sm text-[var(--muted)]">No automation rules yet.</li>
          )}
          {rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 p-4 text-sm">
              <span className="font-medium">{r.name || "Untitled"}</span>
              <span className="text-[var(--muted)]">
                {r.enabled ? "on" : "off"}
              </span>
              <button
                type="button"
                className="ml-auto text-red-600"
                onClick={() => void deleteRule(r.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-[var(--muted)]">
          Advanced JSON rules/workflows are available via{" "}
          <code className="rounded bg-[var(--muted)]/10 px-1">/api/automation/rules</code> and{" "}
          <code className="rounded bg-[var(--muted)]/10 px-1">/api/automation/workflows</code>.
          Export mail as CSV from{" "}
          <code className="rounded bg-[var(--muted)]/10 px-1">/api/export/messages</code>.
        </p>
      </Panel>

      <Panel
        title="Workflows"
        description="Multi-step chains (trigger + ordered actions) run after single-step rules."
      >
        <ul className="rounded-xl border border-[var(--border)]">
          {workflows.length === 0 && (
            <li className="p-4 text-sm text-[var(--muted)]">No workflows yet — use the API to define triggers and steps.</li>
          )}
          {workflows.map((w) => (
            <li key={w.id} className="border-b border-[var(--border)] p-4 text-sm last:border-0">
              {w.name || "Untitled"} · {w.enabled ? "enabled" : "disabled"}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Important contacts" description="Used by important-contact automation conditions.">
        <form onSubmit={addContact} className="flex flex-wrap gap-2">
          <input
            name="pattern"
            className="min-w-[200px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="email or @domain"
          />
          <button
            type="submit"
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium"
          >
            Add
          </button>
        </form>
        <ul className="mt-3 space-y-1 text-sm">
          {contacts.map((c) => (
            <li key={c.id} className="flex justify-between gap-2">
              <code>{c.pattern}</code>
              <button type="button" className="text-red-600" onClick={() => void removeContact(c.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Team workspaces"
        description="Create a workspace to share your inbox with admins, members, or viewers. Use inboxOwnerId query param on mail APIs when opening a shared mailbox."
      >
        <form onSubmit={createWorkspace} className="flex flex-wrap gap-2">
          <input
            name="wsname"
            className="min-w-[200px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            placeholder="Workspace name"
          />
          <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white">
            Create
          </button>
        </form>
        <ul className="mt-3 space-y-2 text-sm">
          {workspaceList.map((w) => (
            <li key={w.id} className="rounded-lg border border-[var(--border)] px-3 py-2">
              <span className="font-medium">{w.name}</span> · role: {w.role}
              <div className="text-xs text-[var(--muted)]">Inbox owner ID: {w.inboxOwnerUserId}</div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function FiltersPanel({
  blocked,
  rules,
  labels,
  onReload,
  showToast,
  setErr,
}: {
  blocked: Overview["blocked"];
  rules: Overview["rules"];
  labels: Overview["labels"];
  onReload: () => Promise<void>;
  showToast: (s: string) => void;
  setErr: (s: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [from, setFrom] = useState("");
  const [action, setAction] = useState<"trash" | "label">("trash");
  const [labelId, setLabelId] = useState("");

  async function addBlock(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings/blocked", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr((j as { error?: string }).error ?? "Failed");
      return;
    }
    setEmail("");
    showToast("Blocked");
    await onReload();
  }

  async function removeBlock(id: string) {
    await fetch(`/api/settings/blocked?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    showToast("Unblocked");
    await onReload();
  }

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings/filters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        fromMatch: from,
        action,
        labelId: action === "label" ? labelId : undefined,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr((j as { error?: string }).error ?? "Failed");
      return;
    }
    setFrom("");
    showToast("Rule added");
    await onReload();
  }

  async function removeRule(id: string) {
    await fetch(`/api/settings/filters/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    showToast("Rule removed");
    await onReload();
  }

  const labelName = useMemo(() => {
    const m = new Map(labels.map((l) => [l.id, l.name]));
    return (id: string | null) => (id ? m.get(id) ?? id : "");
  }, [labels]);

  return (
    <>
      <Panel
        title="Blocked senders"
        description="Inbound mail from these addresses is dropped silently."
      >
        <form onSubmit={addBlock} className="flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            placeholder="email@example.com or @domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm text-white"
          >
            Block
          </button>
        </form>
        <ul className="mt-3 space-y-1 text-sm">
          {blocked.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
            >
              <span>{b.email}</span>
              <button
                type="button"
                onClick={() => removeBlock(b.id)}
                className="text-xs text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Rules"
        description="First matching rule wins. Use full address or @domain for entire domain."
      >
        <form onSubmit={addRule} className="space-y-3">
          <input
            className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            placeholder="From matches (e.g. person@site.com or @spam.com)"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={action === "trash"}
                onChange={() => setAction("trash")}
              />
              Move to trash
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={action === "label"}
                onChange={() => setAction("label")}
              />
              Apply label
            </label>
          </div>
          {action === "label" && (
            <select
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              value={labelId}
              onChange={(e) => setLabelId(e.target.value)}
              required
            >
              <option value="">Choose label…</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="submit"
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm"
          >
            Add rule
          </button>
        </form>
        <ul className="mt-4 space-y-2 text-sm">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2"
            >
              <span>
                <span className="font-medium">{r.fromMatch}</span>
                <span className="text-[var(--muted)]">
                  {" "}
                  →{" "}
                  {r.action === "trash"
                    ? "Trash"
                    : `Label: ${labelName(r.labelId)}`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeRule(r.id)}
                className="text-xs text-red-600"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function PrivacyPanel({
  settings,
  patchSettings,
}: {
  settings: SettingsRow;
  patchSettings: (
    p: Record<string, string | boolean>,
    msg?: string
  ) => Promise<void>;
}) {
  return (
    <Panel
      title="Privacy"
      description="Applies to how inbound mail is stored and how messages render in Aura."
    >
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.blockTrackers}
          onChange={(e) => patchSettings({ blockTrackers: e.target.checked })}
        />
        Strip obvious tracking pixels from HTML mail
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.readReceiptsOutgoing}
          onChange={(e) =>
            patchSettings({ readReceiptsOutgoing: e.target.checked })
          }
        />
        Request read receipts on outgoing mail (when supported by provider)
      </label>
      <div>
        <p className="text-xs font-medium text-[var(--muted)]">External images</p>
        <select
          className="mt-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
          value={settings.externalImages}
          onChange={(e) =>
            patchSettings({ externalImages: e.target.value }, "Saved")
          }
        >
          <option value="always">Always load</option>
          <option value="ask">Ask (default UI)</option>
          <option value="never">Never load (show placeholders)</option>
        </select>
      </div>
    </Panel>
  );
}

function NotificationsPanel({
  settings,
  patchSettings,
}: {
  settings: SettingsRow;
  patchSettings: (
    p: Record<string, string | boolean>,
    msg?: string
  ) => Promise<void>;
}) {
  return (
    <Panel
      title="Notifications"
      description="Browser alerts are optional; server-side alerts can be added later."
    >
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.notificationsEnabled}
          onChange={async (e) => {
            const on = e.target.checked;
            if (on && typeof Notification !== "undefined") {
              await Notification.requestPermission();
            }
            await patchSettings({ notificationsEnabled: on });
          }}
        />
        Enable desktop notifications for this browser
      </label>
    </Panel>
  );
}

function SubscriptionPanel({
  billing,
  userCreatedAt,
  tempInbox,
  showToast,
  setErr,
  onReload,
}: {
  billing: BillingInfo;
  userCreatedAt: string;
  tempInbox: TempInboxSubscriptionState;
  showToast: (s: string) => void;
  setErr: (s: string) => void;
  onReload: () => Promise<void>;
}) {
  const [cancelling, setCancelling] = useState(false);
  const displayPrice =
    typeof process !== "undefined"
      ? (process.env.NEXT_PUBLIC_RAZORPAY_PLAN_DISPLAY_PRICE ?? "₹199")
      : "₹199";
  // eslint-disable-next-line react-hooks/purity -- used for time-based subscription status display
  const nowMs = Date.now();
  const businessAccessActive =
    billing.plan === "business" &&
    (!billing.planExpiresAt || new Date(billing.planExpiresAt).getTime() > nowMs);
  const isPastDue = billing.planStatus === "past_due";
  const isCancelled = billing.planStatus === "cancelled";
  const renewalSource = billing.nextBillingAt ?? billing.planExpiresAt;
  const nextBillingDate = renewalSource
    ? new Date(renewalSource).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const anyActive = businessAccessActive || tempInbox.active;

  async function handleCancelBusiness() {
    if (
      !confirm(
        "Cancel your subscription? You will keep Business access until the end of the current billing period."
      )
    ) {
      return;
    }
    setCancelling(true);
    setErr("");
    const res = await fetch("/api/razorpay/cancel-subscription", {
      method: "POST",
      credentials: "include",
    });
    const j = await res.json().catch(() => ({}));
    setCancelling(false);
    if (!res.ok) {
      setErr((j as { error?: string }).error ?? "Could not cancel subscription");
      return;
    }
    showToast("Subscription cancelled — access continues until billing period ends");
    await onReload();
  }

  if (!anyActive) {
    return (
      <Panel
        title="Subscription"
        description="Manage your active plans and upgrade when needed."
      >
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-5">
          <p className="text-sm font-semibold text-[var(--foreground)]">No active plan</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Activate Business Email or Temporary Inbox using the existing upgrade flow.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/upgrade#pricing"
              className="inline-block rounded-full bg-[#6d4aff] px-5 py-2 text-sm font-bold text-white shadow hover:bg-[#5b3dff] transition-colors"
            >
              Activate your Business Email
            </Link>
            <Link
              href="/temp-inbox/upgrade"
              className="inline-block rounded-full border border-[var(--border)] px-5 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              Activate Temporary Inbox
            </Link>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Subscription"
      description="Overview of active plans and their lifecycle."
    >
      <div className="space-y-4">
        {businessAccessActive && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Business Email</p>
                <p className="text-xs text-[var(--muted)]">Status: Active</p>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                {displayPrice}/month
              </span>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--muted)]">Activation date</dt>
                <dd className="font-medium">
                  {new Date(userCreatedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Expiry/removal date</dt>
                <dd className="font-medium">{nextBillingDate ?? "Not set"}</dd>
              </div>
            </dl>
            {!isCancelled && billing.hasSubscription && (
              <button
                type="button"
                onClick={handleCancelBusiness}
                disabled={cancelling}
                className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
              >
                {cancelling ? "Cancelling…" : "Cancel"}
              </button>
            )}
          </div>
        )}

        {tempInbox.active && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 space-y-3">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Temporary Inbox</p>
              <p className="text-xs text-[var(--muted)]">Status: Active</p>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--muted)]">Activation date</dt>
                <dd className="font-medium">
                  {tempInbox.activationDate
                    ? new Date(tempInbox.activationDate).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Expiry/removal date</dt>
                <dd className="font-medium">
                  {tempInbox.expiryDate
                    ? new Date(tempInbox.expiryDate).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "Not available"}
                </dd>
              </div>
            </dl>
            <Link
              href="/temp-inbox/upgrade"
              className="inline-block rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
            >
              Cancel
            </Link>
          </div>
        )}
      </div>

      {isPastDue && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          Your last Business payment failed. Please update your payment method to avoid losing access.
        </div>
      )}
    </Panel>
  );
}

function StoragePanel({
  storage,
  showToast,
  setErr,
  onReload,
}: {
  storage: Overview["storage"];
  showToast: (s: string) => void;
  setErr: (s: string) => void;
  onReload: () => Promise<void>;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupErr, setCleanupErr] = useState("");
  type LargeAttachmentRow = {
    attachmentId: string;
    messageId: string;
    filename: string;
    sizeBytes: number;
    subject: string;
    trashDeleteAfterAt: string | null;
    reclaimBytes: number;
  };

  type TrashMessageCandidateRow = {
    id: string;
    subject: string;
    trashMovedAt: string | null;
    trashDeleteAfterAt: string | null;
    messageBytes: number;
    attachmentBytes: number;
    totalBytes: number;
    attachmentCount: number;
    topAttachmentFilename: string | null;
    topAttachmentSizeBytes: number | null;
  };

  type StorageCleanupSuggestion = {
    id: string;
    title: string;
    detail: string;
    reclaimBytes: number;
    cta?:
      | { kind: "trash"; deleteIds?: string[] }
      | { kind: "drafts" };
  };

  const [cleanupData, setCleanupData] = useState<null | {
    trash: { messageCount: number; bytesUsed: number };
    largeAttachments: { minBytes: number; attachments: LargeAttachmentRow[] };
    nearing: {
      totalBytes: number;
      days: number;
      messages: TrashMessageCandidateRow[];
    };
    largest: { messages: TrashMessageCandidateRow[] };
    drafts: {
      updatedAt: string | null;
      attachmentBytes: number;
      attachmentCount: number;
    };
    suggestions: StorageCleanupSuggestion[];
  }>(null);

  const [selectedNearingIds, setSelectedNearingIds] = useState<string[]>([]);

  async function clearTrash() {
    if (!confirm("Permanently delete everything in Trash?")) return;
    const res = await fetch("/api/settings/clear-trash", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      setErr("Could not empty trash");
      return;
    }
    showToast("Trash emptied");
  }

  async function loadCleanup() {
    setCleanupErr("");
    setCleanupBusy(true);
    try {
      const res = await fetch("/api/settings/storage/cleanup", {
        credentials: "include",
      });
      if (!res.ok) {
        setCleanupErr("Could not load storage cleanup tools");
        return;
      }
      const j = (await res.json()) as NonNullable<typeof cleanupData>;
      setCleanupData(j);
    } catch {
      setCleanupErr("Could not load storage cleanup tools");
    } finally {
      setCleanupBusy(false);
    }
  }

  useEffect(() => {
    if (!detailsOpen) return;
    if (cleanupData) return;
    void loadCleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per open
  }, [detailsOpen]);

  function daysLeftLabel(iso: string | null) {
    if (!iso) return "—";
    const d = new Date(iso).getTime();
    const now = Date.now();
    const diffMs = d - now;
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    if (days <= 0) return "Ready for cleanup";
    return `Auto-deletes in ${days} day${days === 1 ? "" : "s"}`;
  }

  async function deleteTrashIds(ids: string[]) {
    if (ids.length === 0) return;
    const ok = confirm("Permanently delete selected Trash items?");
    if (!ok) return;

    const res = await fetch("/api/settings/clear-trash/selected", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      setErr("Could not delete selected items");
      return;
    }
    showToast("Selected items deleted");
    setSelectedNearingIds([]);
    await onReload();
    // Refresh tool data if panel is open.
    if (detailsOpen) await loadCleanup();
  }

  async function deleteDrafts() {
    const ok = confirm("Delete draft & draft attachments permanently?");
    if (!ok) return;
    const res = await fetch("/api/mail/drafts", {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      setErr("Could not delete drafts");
      return;
    }
    showToast("Draft deleted");
    await onReload();
    if (detailsOpen) await loadCleanup();
  }

  const used = Math.max(0, Number(storage.bytesUsed ?? 0));
  const limit = Math.max(0, Number(storage.limitBytes ?? 0));
  const remaining = Number(storage.remainingBytes ?? 0);
  const ratio = limit > 0 ? Math.min(1, Math.max(0, used / limit)) : 0;

  const planName = storage.effectivePlan === "business" ? "Business" : "Free";
  const barClass =
    storage.usageLevel === "full"
      ? "bg-red-600"
      : storage.usageLevel === "warning95"
        ? "bg-amber-500"
        : storage.usageLevel === "warning80"
          ? "bg-yellow-500"
          : "bg-[#6d4aff]";

  return (
    <Panel
      title="Storage"
      description="Your current storage usage based on stored message content and attachments."
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm">
              <div className="text-[var(--muted)]">Plan</div>
              <div className="font-semibold">{planName}</div>
            </div>
            <div className="text-right">
              <div className="text-[var(--muted)] text-sm">Usage</div>
              <div className="text-sm font-semibold">
                {formatBytes(used)} used of {formatBytes(limit)}
              </div>
              <div className="text-xs text-[var(--muted)]">
                {remaining >= 0
                  ? `${formatBytes(remaining)} remaining`
                  : `${formatBytes(Math.abs(remaining))} over limit`}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="h-2.5 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
              <div
                className={`h-full ${barClass}`}
                style={{ width: `${Math.round(ratio * 100)}%` }}
                aria-hidden
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--muted)]">
              <span>{Math.round(ratio * 100)}%</span>
              <span>{formatBytes(limit)}</span>
            </div>
          </div>

          {storage.usageMessage && (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                storage.usageLevel === "full"
                  ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
                  : storage.usageLevel === "warning95"
                    ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
                    : storage.usageLevel === "warning80"
                      ? "border-yellow-200 bg-yellow-50 text-yellow-950 dark:border-yellow-900/40 dark:bg-yellow-950/30 dark:text-yellow-200"
                      : "border-[var(--border)] bg-[var(--panel)] text-[var(--fg)]"
              }`}
              role="status"
            >
              {storage.usageMessage}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/inbox?folder=trash"
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
          >
            Open Trash
          </Link>
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
          >
            {detailsOpen ? "Hide details" : "Manage storage"}
          </button>
          <Link
            href="/upgrade"
            className="rounded-full bg-[#6d4aff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5b3dff]"
          >
            Upgrade plan
          </Link>
        </div>

        {detailsOpen && (
          <div className="rounded-xl border border-[var(--border)] p-4 text-sm">
            {cleanupErr && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 mb-3">
                {cleanupErr}
              </div>
            )}
            {cleanupBusy && (
              <div className="text-xs text-[var(--muted)] mb-3">
                Loading cleanup suggestions…
              </div>
            )}

            {cleanupData && (
              <div className="space-y-4">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Smart suggestions</div>
                      <div className="text-xs text-[var(--muted)] mt-1">
                        Trash and draft attachments can be deleted to free space immediately.
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-[var(--muted)]">Trash using</div>
                      <div className="font-semibold">
                        {formatBytes(cleanupData.trash.bytesUsed)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {cleanupData.suggestions.slice(0, 4).map((s) => (
                      <div key={s.id} className="rounded-md border border-[var(--border)] p-3">
                        <div className="text-sm font-medium text-[var(--foreground)]">
                          {s.title}
                        </div>
                        <div className="text-xs text-[var(--muted)] mt-1">
                          {s.detail}
                        </div>
                        {s.reclaimBytes > 0 && (
                          <div className="text-xs mt-2">
                            Potential free:{" "}
                            <span className="font-medium">
                              {formatBytes(s.reclaimBytes)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold">Large attachments (Trash)</div>
                  {cleanupData.largeAttachments.attachments.length === 0 ? (
                    <div className="text-xs text-[var(--muted)]">
                      No attachments above {formatBytes(cleanupData.largeAttachments.minBytes)} found in Trash.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cleanupData.largeAttachments.attachments.map((a) => (
                        <div
                          key={a.attachmentId}
                          className="rounded-md border border-[var(--border)] p-3 flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {a.subject || "(no subject)"}
                            </div>
                            <div className="text-xs text-[var(--muted)] mt-1">
                              {a.filename} • {formatBytes(a.sizeBytes)}
                            </div>
                            <div className="text-xs text-[var(--muted)] mt-1">
                              {daysLeftLabel(a.trashDeleteAfterAt)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteTrashIds([a.messageId])}
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 whitespace-nowrap"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold">Old items nearing auto-delete</div>
                  {cleanupData.nearing.messages.length === 0 ? (
                    <div className="text-xs text-[var(--muted)]">
                      No items scheduled to auto-delete in the next {cleanupData.nearing.days} days.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-[var(--muted)]">
                        Select items to permanently delete now.
                      </div>
                      {cleanupData.nearing.messages.map((m) => {
                        const checked = selectedNearingIds.includes(m.id);
                        return (
                          <label
                            key={m.id}
                            className="flex items-start justify-between gap-3 rounded-md border border-[var(--border)] p-3 cursor-pointer"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...selectedNearingIds, m.id]
                                    : selectedNearingIds.filter((x) => x !== m.id);
                                  setSelectedNearingIds(next);
                                }}
                                className="mt-1 h-4 w-4 accent-[#6d4aff]"
                              />
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {m.subject || "(no subject)"}
                                </div>
                                <div className="text-xs text-[var(--muted)] mt-1">
                                  Attachments: {m.attachmentCount} • {formatBytes(m.attachmentBytes)}
                                </div>
                                <div className="text-xs text-[var(--muted)] mt-1">
                                  {daysLeftLabel(m.trashDeleteAfterAt)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-xs text-[var(--muted)]">Reclaim</div>
                              <div className="text-sm font-semibold">
                                {formatBytes(m.totalBytes)}
                              </div>
                            </div>
                          </label>
                        );
                      })}

                      <div className="flex items-center justify-between gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => deleteTrashIds(selectedNearingIds)}
                          disabled={selectedNearingIds.length === 0}
                          className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:hover:bg-red-600"
                        >
                          Delete selected
                        </button>
                        <div className="text-xs text-[var(--muted)] text-right">
                          Potential free:{" "}
                          <span className="font-medium text-[var(--foreground)]">
                            {formatBytes(
                              cleanupData.nearing.messages
                                .filter((m) => selectedNearingIds.includes(m.id))
                                .reduce(
                                  (acc: number, m: TrashMessageCandidateRow) =>
                                    acc + Number(m.totalBytes ?? 0),
                                  0
                                )
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold">Draft cleanup</div>
                  {cleanupData.drafts.attachmentBytes <= 0 ? (
                    <div className="text-xs text-[var(--muted)]">No draft attachments to clean up.</div>
                  ) : (
                    <div className="rounded-md border border-[var(--border)] p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">
                          Draft attachments using {formatBytes(cleanupData.drafts.attachmentBytes)}
                        </div>
                        <div className="text-xs text-[var(--muted)] mt-1">
                          Deleting drafts will permanently remove attachments and the draft content.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void deleteDrafts()}
                        className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
                      >
                        Delete drafts & attachments
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-[var(--muted)]">Messages</div>
                <div className="font-medium">{storage.messageCount}</div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Mailbox attachments</div>
                <div className="font-medium">{formatBytes(storage.attachmentBytes)}</div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Mailbox content</div>
                <div className="font-medium">
                  {formatBytes(storage.breakdown.mailboxContentBytes)}
                </div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Compose draft</div>
                <div className="font-medium">
                  {formatBytes(storage.breakdown.composeDraftBytes)}
                </div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Compose attachments</div>
                <div className="font-medium">
                  {formatBytes(storage.breakdown.composeAttachmentBytes)}
                </div>
              </div>
              <div>
                <div className="text-[var(--muted)]">Scheduled pending</div>
                <div className="font-medium">
                  {formatBytes(storage.breakdown.scheduledPendingBytes)}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={clearTrash}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium"
              >
                Empty trash now
              </button>
              <span className="text-xs text-[var(--muted)]">
                Trash is auto-deleted after 30 days. It still counts until permanent deletion.
              </span>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
