"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type DnsUi = {
  records: { type: string; name: string; value: string; purpose: string }[];
  verificationHost: string;
  verificationTxt: string;
};

type DnsCheckSummary = {
  spf: string | null;
  dkim: string | null;
  dmarc: string | null;
  mx: string | null;
};

type DomainRow = {
  id: string;
  domainName: string;
  verificationStatus: string;
  operationalStatus?: string;
  sendingEnabled?: boolean;
  sendingDisabledSource?: string | null;
  verifiedAt: string | null;
  failureReason: string | null;
  dnsUi?: DnsUi;
  dnsCheckSummary?: DnsCheckSummary;
};

type MailboxRow = {
  id: string;
  emailAddress: string;
  active: boolean;
  isDefaultSender: boolean;
  domainName: string;
};

type Profile = {
  businessName: string;
  displayNameDefault: string;
  logoUrl: string | null;
  website: string | null;
  supportContact: string | null;
  brandColor: string | null;
};

export function BusinessSettingsPanel({
  isBusiness,
  showToast,
  setErr,
}: {
  isBusiness: boolean;
  showToast: (s: string) => void;
  setErr: (s: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [goldenTickEligible, setGoldenTickEligible] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxRow[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [mbDomainId, setMbDomainId] = useState("");
  const [mbLocal, setMbLocal] = useState("info");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isBusiness) {
      setLoading(false);
      return;
    }
    setErr("");
    const res = await fetch("/api/business", { credentials: "include" });
    if (res.status === 403) {
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setErr("Could not load Business settings");
      setLoading(false);
      return;
    }
    const b = (await res.json()) as {
      profile: Profile | null;
      goldenTickEligible: boolean;
    };
    setProfile(
      b.profile ?? {
        businessName: "",
        displayNameDefault: "",
        logoUrl: null,
        website: null,
        supportContact: null,
        brandColor: null,
      }
    );
    setGoldenTickEligible(b.goldenTickEligible);

    const dr = await fetch("/api/domains", { credentials: "include" });
    if (dr.ok) {
      const dj = (await dr.json()) as { domains: DomainRow[] };
      setDomains(dj.domains as DomainRow[]);
      const firstReady = dj.domains.find(
        (x) =>
          x.verificationStatus === "verified" &&
          (x.operationalStatus ?? "pending") === "active"
      );
      setMbDomainId((prev) => prev || firstReady?.id || dj.domains[0]?.id || "");
    }

    const mr = await fetch("/api/mailboxes", { credentials: "include" });
    if (mr.ok) {
      const mj = (await mr.json()) as { mailboxes: MailboxRow[] };
      setMailboxes(mj.mailboxes);
    }
    setLoading(false);
  }, [isBusiness, setErr]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function saveProfile() {
    if (!profile) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/business", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        businessName: profile.businessName,
        displayNameDefault: profile.displayNameDefault,
        logoUrl: profile.logoUrl,
        website: profile.website,
        supportContact: profile.supportContact,
        brandColor: profile.brandColor,
      }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr((j as { error?: string }).error ?? "Save failed");
      return;
    }
    setGoldenTickEligible(Boolean((j as { goldenTickEligible?: boolean }).goldenTickEligible));
    showToast("Business profile saved");
  }

  async function addDomain(e: React.FormEvent) {
    e.preventDefault();
    if (!newDomain.trim()) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/domains", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ domainName: newDomain.trim() }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr((j as { error?: string }).error ?? "Could not add domain");
      return;
    }
    setNewDomain("");
    showToast("Domain added — add DNS records then verify");
    await load();
  }

  async function verifyDomain(id: string) {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/domains/${id}/verify`, {
      method: "POST",
      credentials: "include",
    });
    setBusy(false);
    const j = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      reason?: string;
    };
    if (!res.ok) {
      setErr(j.error ?? "Verify failed");
      return;
    }
    if (j.ok) {
      showToast("Domain verified");
      setErr("");
    } else {
      setErr(j.reason ?? "Verification failed — check DNS records and wait for propagation.");
      showToast("Verification did not pass yet");
    }
    await load();
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${label}`);
    } catch {
      setErr("Could not copy — select and copy manually.");
    }
  }

  async function addMailbox(e: React.FormEvent) {
    e.preventDefault();
    if (!mbDomainId || !mbLocal.trim()) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/mailboxes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        domainId: mbDomainId,
        localPart: mbLocal.trim().toLowerCase(),
        isDefaultSender: mailboxes.length === 0,
      }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr((j as { error?: string }).error ?? "Could not create mailbox");
      return;
    }
    showToast("Mailbox created");
    setMbLocal("support");
    await load();
  }

  async function setDefaultMailbox(id: string) {
    setBusy(true);
    const res = await fetch(`/api/mailboxes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ isDefaultSender: true }),
    });
    setBusy(false);
    if (!res.ok) return;
    showToast("Default sender updated");
    await load();
  }

  if (!isBusiness) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">Business</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Custom domains, verified sender identity, and multiple mailboxes require Sendora Business.
        </p>
        <Link
          href="/upgrade"
          className="mt-4 inline-block rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-2 text-sm font-bold text-white shadow hover:opacity-90"
        >
          Upgrade to Business
        </Link>
      </section>
    );
  }

  if (loading) {
    return (
      <p className="text-sm text-[var(--muted)]">Loading business settings…</p>
    );
  }

  if (!profile) {
    return (
      <p className="text-sm text-[var(--muted)]">Could not load business profile.</p>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">Business profile</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Shown with your sender identity in Sendora. The golden verified badge
          appears when your Business subscription is active (including after
          cancel, until the paid period ends).{" "}
          <span className="font-medium text-[var(--foreground)]">
            {goldenTickEligible ? "Verified Business badge is on." : "Not shown (plan inactive or billing issue)."}
          </span>
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-[var(--muted)]">Business name</span>
            <input
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2"
              value={profile.businessName}
              onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Display name</span>
            <input
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2"
              value={profile.displayNameDefault}
              onChange={(e) => setProfile({ ...profile, displayNameDefault: e.target.value })}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-[var(--muted)]">Logo URL</span>
            <input
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2"
              value={profile.logoUrl ?? ""}
              onChange={(e) => setProfile({ ...profile, logoUrl: e.target.value || null })}
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Website</span>
            <input
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2"
              value={profile.website ?? ""}
              onChange={(e) => setProfile({ ...profile, website: e.target.value || null })}
            />
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Support contact</span>
            <input
              className="mt-1 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2"
              value={profile.supportContact ?? ""}
              onChange={(e) => setProfile({ ...profile, supportContact: e.target.value || null })}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveProfile()}
          className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save profile
        </button>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">Custom domain</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Add your domain, publish the DNS records shown, then verify.
        </p>
        <form onSubmit={addDomain} className="mt-4 flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            placeholder="yourcompany.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Add domain
          </button>
        </form>
        <ul className="mt-4 space-y-4">
          {domains.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{d.domainName}</span>
                <span className="text-xs text-[var(--muted)]">{d.verificationStatus}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Operational: {d.operationalStatus ?? "—"}
                {" · "}
                Sending:{" "}
                {d.sendingEnabled
                  ? "on"
                  : d.sendingDisabledSource === "admin"
                    ? "off (admin)"
                    : "off (system)"}
              </p>
              {d.dnsCheckSummary && (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  SPF {d.dnsCheckSummary.spf ?? "—"} · DKIM {d.dnsCheckSummary.dkim ?? "—"} ·
                  DMARC {d.dnsCheckSummary.dmarc ?? "—"} · MX {d.dnsCheckSummary.mx ?? "—"}
                </p>
              )}
              {d.failureReason && (
                <p className="mt-1 text-xs text-red-600">{d.failureReason}</p>
              )}

              {d.verificationStatus !== "verified" && d.dnsUi && (
                <div className="mt-3 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-xs">
                  <p className="font-semibold text-[var(--foreground)]">DNS records to add</p>
                  <p className="text-[var(--muted)]">
                    Create a <strong>TXT</strong> record at your DNS provider (Cloudflare, GoDaddy,
                    etc.). Verification hostname and value:
                  </p>
                  <div className="space-y-1 font-mono text-[11px] break-all">
                    <div>
                      <span className="text-[var(--muted)]">Host / Name: </span>
                      {d.dnsUi.verificationHost}
                      <button
                        type="button"
                        className="ml-2 text-[var(--accent)] underline"
                        onClick={() => void copyText("host", d.dnsUi!.verificationHost)}
                      >
                        Copy
                      </button>
                    </div>
                    <div>
                      <span className="text-[var(--muted)]">TXT value: </span>
                      {d.dnsUi.verificationTxt}
                      <button
                        type="button"
                        className="ml-2 text-[var(--accent)] underline"
                        onClick={() => void copyText("TXT value", d.dnsUi!.verificationTxt)}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  <details className="text-[var(--muted)]">
                    <summary className="cursor-pointer text-[var(--accent)]">MX &amp; SPF (email delivery)</summary>
                    <ul className="mt-2 list-disc pl-4 space-y-1">
                      {d.dnsUi.records
                        .filter(
                          (r) =>
                            !(r.type === "TXT" && r.name === d.dnsUi!.verificationHost)
                        )
                        .map((r) => (
                          <li key={`${r.type}-${r.name}-${r.value}`}>
                            <strong>{r.type}</strong> {r.name}: {r.value}
                          </li>
                        ))}
                    </ul>
                  </details>
                </div>
              )}

              {d.verificationStatus !== "verified" && (
                <button
                  type="button"
                  disabled={busy}
                  className="mt-3 text-xs font-medium text-[var(--accent)] hover:underline disabled:opacity-50"
                  onClick={() => void verifyDomain(d.id)}
                >
                  Verify DNS
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-base font-semibold">Mailboxes</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Create addresses on a verified domain. Set one as default for sending.
        </p>
        <form onSubmit={addMailbox} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="text-[var(--muted)]">Domain</span>
            <select
              className="mt-1 block rounded-xl border border-[var(--border)] bg-transparent px-3 py-2"
              value={mbDomainId}
              onChange={(e) => setMbDomainId(e.target.value)}
            >
              {domains
                .filter(
                  (x) =>
                    x.verificationStatus === "verified" &&
                    (x.operationalStatus ?? "") === "active"
                )
                .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.domainName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-[var(--muted)]">Local part</span>
            <input
              className="mt-1 w-32 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2"
              value={mbLocal}
              onChange={(e) => setMbLocal(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !mbDomainId}
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Add mailbox
          </button>
        </form>
        <ul className="mt-4 space-y-2 text-sm">
          {mailboxes.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
            >
              <span>
                {m.emailAddress}
                {m.isDefaultSender && (
                  <span className="ml-2 text-xs text-[var(--muted)]">(default)</span>
                )}
              </span>
              {!m.isDefaultSender && (
                <button
                  type="button"
                  className="text-xs font-medium text-[var(--accent)] hover:underline"
                  onClick={() => void setDefaultMailbox(m.id)}
                >
                  Set default
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
