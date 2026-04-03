"use client";

import { useState } from "react";
import Link from "next/link";
import { ensureRazorpayCheckout } from "@/lib/razorpay-checkout";
import { TEMP_INBOX_DAILY_MAX } from "@/lib/temp-inbox";
import { InternationalPaymentsRequest } from "@/components/international-payments-request";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function TempInboxUpgradePage({
  email,
  razorpayKeyId,
}: {
  email: string;
  razorpayKeyId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);

  async function subscribe() {
    setErr("");
    if (!razorpayKeyId) {
      setErr("Payment is not configured yet. Please contact support.");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/razorpay/create-temp-inbox-subscription", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        subscriptionId?: string;
        error?: string;
      };

      if (!res.ok || !data.subscriptionId) {
        setErr(data.error ?? "Could not start payment.");
        setLoading(false);
        return;
      }

      await ensureRazorpayCheckout();
      const rzp = new window.Razorpay({
        key: razorpayKeyId,
        subscription_id: data.subscriptionId,
        name: "Sendora",
        description: "Temporary Inbox — ₹10/week",
        image: "/sendora-logo.png",
        prefill: { email },
        theme: { color: "#16a34a" },
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
          const v = (await verify.json().catch(() => ({}))) as {
            ok?: boolean;
            error?: string;
          };

          if (!verify.ok || !v.ok) {
            setErr(v.error ?? "Verification failed.");
            setLoading(false);
            return;
          }

          setSuccess(true);
          window.location.href = "/temp-inbox";
        },
      });
      rzp.open();
    } catch {
      setErr("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#f3f0fd] flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow-lg border border-[#e8e4f8] p-10 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-[#1c1b33] mb-2">
            Temporary Inbox activated!
          </h1>
          <p className="text-[#65637e] mb-6">
            You can now generate private temporary inbox emails.
          </p>
          <Link
            href="/temp-inbox"
            className="block w-full rounded-full bg-[#16a34a] py-3 text-white font-semibold text-sm hover:opacity-90 transition-colors"
          >
            Go to Temporary Inbox
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#1c1b33]">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#e8e4f8]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/inbox" className="flex items-center gap-2.5">
            <img src="/sendora-logo.png" alt="Sendora" className="w-8 h-8 object-contain" />
            <span className="text-[15px] font-bold tracking-tight text-[#1c1b33]">Sendora</span>
          </Link>
          <div className="text-sm text-[#65637e] hidden sm:block">{email}</div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#1c1b33]">Temporary Inbox</h1>
          <p className="text-[#65637e] mt-3">
            Private temp emails designed for OTPs. They expire automatically and are deleted when expired.
          </p>
        </div>

        <div className="rounded-2xl border border-[#e8e4f8] bg-[#faf9fe] p-6">
          <div className="text-sm font-semibold text-[#65637e]">Price</div>
          <div className="text-4xl font-extrabold mt-1">₹10</div>
          <div className="text-sm text-[#9896b4]">per week</div>

          <button
            type="button"
            onClick={() => void subscribe()}
            disabled={loading}
            className="mt-6 w-full rounded-full bg-[#1c1b33] text-white text-sm font-bold py-2.5 hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Processing…" : "Subscribe"}
          </button>

          <div className="mt-3">
            <InternationalPaymentsRequest initialEmail={email} />
          </div>

          {err && <p className="mt-3 text-sm text-red-500">{err}</p>}

          <p className="mt-4 text-xs text-[#9896b4]">
            After subscribing, you can generate up to {TEMP_INBOX_DAILY_MAX} temp inboxes per day.
          </p>
        </div>
      </main>
    </div>
  );
}

