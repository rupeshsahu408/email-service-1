"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { professionalEmailForHandle } from "@/lib/professional-email";
import { ensureRazorpayCheckout } from "@/lib/razorpay-checkout";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type BillingInfo = {
  proPlanStatus: string;
  proPlanExpiresAt: string | null;
};

export function ProfessionalSettingsPanel({
  billing,
  showToast,
  setErr,
}: {
  billing: BillingInfo;
  showToast: (s: string) => void;
  setErr: (s: string) => void;
}) {
  const PROFESSIONAL_DISABLED = true;

  const [handle, setHandle] = useState("");
  const [savedHandle, setSavedHandle] = useState<string | null>(null);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const proActive =
    billing.proPlanStatus === "active" || billing.proPlanStatus === "cancelled";
  const preview = useMemo(() => {
    const v = handle.trim().toLowerCase();
    if (!v) return "name@name.sendora.me";
    try {
      return professionalEmailForHandle(v);
    } catch {
      return "name@name.sendora.me";
    }
  }, [handle]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (PROFESSIONAL_DISABLED) return;
      const res = await fetch("/api/professional/profile", { credentials: "include" });
      if (!res.ok || cancelled) return;
      const j = (await res.json()) as {
        profile?: { handle: string; emailAddress: string } | null;
      };
      if (cancelled) return;
      if (j.profile) {
        setSavedHandle(j.profile.handle);
        setSavedEmail(j.profile.emailAddress);
        setHandle(j.profile.handle);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (PROFESSIONAL_DISABLED) return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  async function checkAvailability() {
    setChecking(true);
    setAvailable(null);
    setErr("");
    const h = handle.trim();
    const res = await fetch(
      `/api/professional/check-handle?handle=${encodeURIComponent(h)}`,
      { credentials: "include" }
    );
    const j = (await res.json().catch(() => ({}))) as {
      available?: boolean;
      error?: string;
    };
    setChecking(false);
    if (!res.ok) {
      setErr(j.error ?? "Could not check handle availability");
      return;
    }
    setAvailable(Boolean(j.available));
  }

  async function saveIdentity() {
    setSaving(true);
    setErr("");
    const res = await fetch("/api/professional/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ handle: handle.trim().toLowerCase() }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      error?: string;
      profile?: { handle: string; emailAddress: string };
    };
    setSaving(false);
    if (!res.ok) {
      setErr(j.error ?? "Could not save identity");
      return;
    }
    setSavedHandle(j.profile?.handle ?? handle.trim().toLowerCase());
    setSavedEmail(j.profile?.emailAddress ?? professionalEmailForHandle(handle));
    showToast("Professional identity saved");
  }

  async function startProfessionalUpgrade() {
    if (PROFESSIONAL_DISABLED) {
      setErr("Professional Email is coming soon and is currently disabled.");
      return;
    }
    const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
    if (!key) {
      setErr("Payment is not configured yet. Please contact support.");
      return;
    }
    const create = await fetch("/api/razorpay/create-pro-subscription", {
      method: "POST",
      credentials: "include",
    });
    const j = (await create.json().catch(() => ({}))) as {
      subscriptionId?: string;
      error?: string;
    };
    if (!create.ok || !j.subscriptionId) {
      setErr(j.error ?? "Could not start upgrade.");
      return;
    }

    try {
      await ensureRazorpayCheckout();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load payment checkout.");
      return;
    }

    const rzp = new window.Razorpay({
      key,
      subscription_id: j.subscriptionId,
      name: "Sendora",
      description: "Professional Plan — ₹20/month, auto-renews monthly",
      handler: async (response: {
        razorpay_payment_id: string;
        razorpay_subscription_id: string;
        razorpay_signature: string;
      }) => {
        const verify = await fetch("/api/razorpay/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(response),
        });
        const out = (await verify.json().catch(() => ({}))) as { error?: string };
        if (!verify.ok) {
          setErr(out.error ?? "Verification failed.");
          return;
        }
        showToast("Professional plan activated");
        window.location.reload();
      },
    });
    rzp.open();
  }

  if (PROFESSIONAL_DISABLED) {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">Professional Email - Coming Soon</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Professional features are temporarily disabled. We&apos;ll enable
            them once the launch is complete.
          </p>
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <p className="text-sm text-[var(--muted)]">For now, only Business plan is available.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="text-2xl font-semibold">
          Create your professional email identity in seconds ✨
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          No domain needed. Get a clean, branded email that actually looks
          professional.
        </p>
        <div className="mt-4 grid gap-2 text-sm">
          <p>⚡ No domain required</p>
          <p>🎯 Perfect for creators, students & freelancers</p>
          <p>✨ Clean and professional email identity</p>
          <p>🚀 Ready in seconds</p>
          <p>🔒 Secure and reliable</p>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-3">
        <h3 className="text-base font-semibold">Example emails</h3>
        <p className="text-sm text-[var(--muted)]">rupesh@rupesh.sendora.me</p>
        <p className="text-sm text-[var(--muted)]">contact@creator.sendora.me</p>
        <p className="text-sm text-[var(--muted)]">hello@startup.sendora.me</p>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h3 className="text-base font-semibold">Why choose Professional Plan</h3>
        <ul className="mt-3 space-y-1 text-sm text-[var(--muted)]">
          <li>Stand out from generic Gmail addresses</li>
          <li>Build your personal brand</li>
          <li>Look professional in every email</li>
          <li>No technical setup required</li>
        </ul>
        <h3 className="text-base font-semibold mt-5">How it works</h3>
        <ol className="mt-3 space-y-1 text-sm text-[var(--muted)]">
          <li>1. Choose your name</li>
          <li>2. Create your identity</li>
          <li>3. Start sending emails</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h3 className="text-base font-semibold">₹20/month</h3>
        <p className="text-sm text-[var(--muted)]">
          Affordable professional identity for everyone
        </p>
        {!proActive ? (
          <button
            type="button"
            onClick={() => void startProfessionalUpgrade()}
            className="mt-4 rounded-full bg-[#1c1b33] px-5 py-2 text-sm font-semibold text-white"
          >
            Upgrade to Professional 🚀
          </button>
        ) : (
          <div className="mt-3 text-sm font-semibold text-green-600">
            Professional Plan Active
          </div>
        )}
        {!proActive && (
          <p className="mt-3 text-xs text-[var(--muted)]">
            You can also upgrade from <Link href="/upgrade" className="underline">Upgrade</Link>.
          </p>
        )}
      </section>

      {proActive && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <h3 className="text-base font-semibold">Your professional handle</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Email format: name@name.sendora.me
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              className="flex-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value.toLowerCase());
                setAvailable(null);
              }}
              placeholder="e.g. rupesh"
            />
            <button
              type="button"
              onClick={() => void checkAvailability()}
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
              disabled={checking}
            >
              {checking ? "Checking..." : "Check"}
            </button>
            <button
              type="button"
              onClick={() => void saveIdentity()}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm text-white"
              disabled={saving}
            >
              {saving ? "Saving..." : "Create identity"}
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">Preview: {preview}</p>
          {available === true && (
            <p className="mt-2 text-xs text-green-600">Available</p>
          )}
          {available === false && (
            <p className="mt-2 text-xs text-red-600">Taken</p>
          )}
          {savedHandle && savedEmail && (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm">
              <p className="font-medium">Current identity</p>
              <p className="text-[var(--muted)] mt-1">
                {savedHandle} — {savedEmail}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
