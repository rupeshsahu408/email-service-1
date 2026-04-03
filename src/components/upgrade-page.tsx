"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ensureRazorpayCheckout } from "@/lib/razorpay-checkout";
import { InternationalPaymentsRequest } from "@/components/international-payments-request";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

const PLAN_AMOUNT_DISPLAY = process.env.NEXT_PUBLIC_RAZORPAY_PLAN_DISPLAY_PRICE ?? "₹199";
const PRO_PLAN_AMOUNT_DISPLAY =
  process.env.NEXT_PUBLIC_RAZORPAY_PRO_PLAN_DISPLAY_PRICE ?? "₹20";

const features = [
  {
    icon: "🌐",
    title: "Custom Domain Email",
    body: "Send and receive mail as you@yourcompany.com. Full control over your professional identity.",
  },
  {
    icon: "✅",
    title: "Golden Verified Tick",
    body: "A trusted badge shown next to your name. Stand out as a verified business sender.",
  },
  {
    icon: "👥",
    title: "Team Inbox",
    body: "Create team mailboxes like support@ and info@. Add members and assign roles.",
  },
  {
    icon: "💾",
    title: "10GB Storage",
    body: "10x more storage than free. Never worry about running out of space for emails.",
  },
  {
    icon: "⚡",
    title: "Priority Delivery",
    body: "Optimised routing for inbox placement. Your emails reach recipients, not spam folders.",
  },
  {
    icon: "🔁",
    title: "Automation Rules",
    body: "Auto-reply, auto-forward, and label rules. Manage email at scale with zero effort.",
  },
];

const trustPoints = [
  { icon: "🔐", label: "Encrypted at rest", sub: "Your emails stay private" },
  { icon: "🚀", label: "Fast delivery", sub: "Under 2 seconds globally" },
  { icon: "🛡️", label: "SPF, DKIM & DMARC", sub: "Trusted authentication" },
  { icon: "💳", label: "Secure payments", sub: "Powered by Razorpay" },
];

const faq = [
  {
    q: "How does auto-pay work?",
    a: "₹199 is charged automatically every month via Razorpay. Your card or UPI is charged on the same date each month — no manual action needed.",
  },
  {
    q: "What happens if I cancel?",
    a: "You can cancel your subscription any time from Razorpay. Your Business features remain active until the end of the billing cycle, then your account moves back to free. All your emails are kept.",
  },
  {
    q: "Is my payment secure?",
    a: "Payments are handled entirely by Razorpay, a PCI-DSS compliant payment gateway. We never store your card or UPI details.",
  },
  {
    q: "Can I add team members?",
    a: "Yes. Business plan lets you create multiple mailboxes and invite team members with role-based access.",
  },
  {
    q: "Does the Golden Tick appear to recipients?",
    a: "The Golden Tick is displayed inside Sendora next to your identity. Recipients see your custom domain in headers.",
  },
  {
    q: "Can I use my existing domain?",
    a: "Yes. Any domain you own can be added and verified. We walk you through the DNS setup step by step.",
  },
];

const comparison = [
  { feature: "Email address", free: "user@sendora.me", business: "you@yourdomain.com" },
  { feature: "Storage", free: "1 GB", business: "10 GB" },
  { feature: "Golden Verified Tick", free: false, business: true },
  { feature: "Custom domain", free: false, business: true },
  { feature: "Team mailboxes", free: false, business: true },
  { feature: "Automation rules", free: "Basic", business: "Advanced" },
  { feature: "Priority delivery", free: false, business: true },
  { feature: "Sendora branding removed", free: false, business: true },
];

export function UpgradePage({
  email,
  plan,
  planExpiresAt,
  professionalActive = false,
  professionalExpiresAt = null,
  razorpayKeyId,
}: {
  email: string;
  plan: string;
  planExpiresAt: string | null;
  professionalActive?: boolean;
  professionalExpiresAt?: string | null;
  razorpayKeyId: string;
}) {
  const [loadingPlan, setLoadingPlan] = useState<
    "business" | "professional" | null
  >(null);
  const [success, setSuccess] = useState(false);
  const [successPlan, setSuccessPlan] = useState<"business" | "professional">(
    "business"
  );
  const [error, setError] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const isBusiness = plan === "business";

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  async function handleUpgrade() {
    if (!razorpayKeyId) {
      setError("Payment is not configured yet. Please contact support.");
      return;
    }
    setLoadingPlan("business");
    setError("");
    try {
      const res = await fetch("/api/razorpay/create-subscription", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start payment.");
        setLoadingPlan(null);
        return;
      }

      await ensureRazorpayCheckout();
      const rzp = new window.Razorpay({
        key: razorpayKeyId,
        subscription_id: data.subscriptionId,
        name: "Sendora",
        description: "Business Plan — ₹199/month, auto-renews monthly",
        image: "/sendora-logo.png",
        prefill: { email },
        theme: { color: "#6d4aff" },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_subscription_id: string;
          razorpay_signature: string;
        }) {
          const verify = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const vdata = await verify.json();
          if (verify.ok) {
            setSuccessPlan("business");
            setSuccess(true);
            setLoadingPlan(null);
          } else {
            setError(vdata.error ?? "Payment verification failed.");
            setLoadingPlan(null);
          }
        },
        modal: {
          ondismiss: () => setLoadingPlan(null),
        },
      });
      rzp.open();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoadingPlan(null);
    }
  }

  async function handleUpgradeProfessional() {
    // Professional is intentionally disabled; do not start any payment flow.
    setError("Professional plan is coming soon and is currently disabled.");
    setLoadingPlan(null);
    return;

    if (!razorpayKeyId) {
      setError("Payment is not configured yet. Please contact support.");
      return;
    }
    setLoadingPlan("professional");
    setError("");
    try {
      const res = await fetch("/api/razorpay/create-pro-subscription", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start payment.");
        setLoadingPlan(null);
        return;
      }
      await ensureRazorpayCheckout();
      const rzp = new window.Razorpay({
        key: razorpayKeyId,
        subscription_id: data.subscriptionId,
        name: "Sendora",
        description: "Professional Plan — ₹20/month, auto-renews monthly",
        image: "/sendora-logo.png",
        prefill: { email },
        theme: { color: "#1c1b33" },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_subscription_id: string;
          razorpay_signature: string;
        }) {
          const verify = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const vdata = await verify.json();
          if (verify.ok) {
            setSuccessPlan("professional");
            setSuccess(true);
            setLoadingPlan(null);
          } else {
            setError(vdata.error ?? "Payment verification failed.");
            setLoadingPlan(null);
          }
        },
        modal: {
          ondismiss: () => setLoadingPlan(null),
        },
      });
      rzp.open();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoadingPlan(null);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#f3f0fd] flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow-lg border border-[#e8e4f8] p-10 max-w-md w-full text-center">
          <img src="/golden-tick.jpg" alt="Verified" className="w-16 h-16 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-[#1c1b33] mb-2">
            {successPlan === "business"
              ? "You're now a Business user!"
              : "Business upgrade complete!"}
          </h1>
          <p className="text-[#65637e] mb-6">
            {successPlan === "business"
              ? "Business tools are active, including your trusted identity."
              : "Professional is coming soon and is currently disabled."}
          </p>
          <Link
            href="/inbox"
            className="block w-full rounded-full bg-[#6d4aff] py-3 text-white font-semibold text-sm hover:bg-[#5b3dff] transition-colors"
          >
            Go to Inbox
          </Link>
          <Link
            href={
              "/settings?section=business"
            }
            className="mt-3 block w-full rounded-full border border-[#e8e4f8] py-3 text-[#6d4aff] font-semibold text-sm hover:bg-[#f3f0fd] transition-colors"
          >
            Manage in Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#1c1b33]">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#e8e4f8]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/inbox" className="flex items-center gap-2.5">
            <img src="/sendora-logo.png" alt="Sendora" className="w-8 h-8 object-contain" />
            <span className="text-[15px] font-bold tracking-tight text-[#1c1b33]">Sendora</span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <span className="text-sm text-[#65637e] hidden sm:block">{email}</span>
            <Link
              href="#pricing"
              className="text-sm font-semibold text-[#6d4aff] hover:underline"
            >
              Plans &amp; pricing
            </Link>
            {isBusiness && (
              <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <img src="/golden-tick.jpg" alt="" className="w-4 h-4 object-contain" />
                Business
              </span>
            )}
            <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-3 py-1.5">
              Professional · Coming Soon
            </span>
          </div>
        </div>
      </header>

      {/* ── 1. HERO ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#f3f0fd] via-white to-amber-50 pt-20 pb-24 px-6 text-center">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#6d4aff]/5 rounded-full blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-[#f3f0fd] border border-[#e8e4f8] text-[#65637e] text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
            Sendora plans
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#1c1b33] tracking-tight leading-tight mb-5">
            Business &amp; Professional
          </h1>
          <p className="text-lg text-[#65637e] max-w-xl mx-auto mb-8 leading-relaxed">
            Two independent subscriptions: custom-domain Business or lightweight Professional
            branding. Choose either, both, or stay on Free—they never block each other.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="#pricing"
              className="rounded-full bg-[#6d4aff] text-white font-bold px-8 py-3.5 text-base hover:bg-[#5b3dff] transition-colors text-center"
            >
              View plans &amp; pricing
            </Link>
            <Link
              href="/inbox"
              className="rounded-full border border-[#e8e4f8] text-[#65637e] font-medium px-8 py-3.5 text-sm hover:border-[#6d4aff] hover:text-[#6d4aff] transition-colors text-center"
            >
              Back to inbox
            </Link>
          </div>
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        </div>
      </section>

      {/* ── 2. TRUST ── */}
      <section className="bg-[#1c1b33] py-12 px-6">
        <div className="mx-auto max-w-5xl grid grid-cols-2 sm:grid-cols-4 gap-6">
          {trustPoints.map((t) => (
            <div key={t.label} className="text-center">
              <div className="text-3xl mb-2">{t.icon}</div>
              <div className="text-white text-sm font-semibold">{t.label}</div>
              <div className="text-[#9896b4] text-xs mt-0.5">{t.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. FEATURES ── */}
      <section id="features" className="py-24 px-6 bg-[#faf9fe]">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1c1b33] tracking-tight">
              Everything in Business
            </h2>
            <p className="mt-3 text-[#65637e] max-w-xl mx-auto">
              One plan. Every professional feature you need to run a trusted email experience.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl border border-[#e8e4f8] p-6 hover:shadow-md hover:border-[#6d4aff]/30 transition-all"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-base font-semibold text-[#1c1b33] mb-1.5">{f.title}</h3>
                <p className="text-sm text-[#65637e] leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. GOLDEN TICK ── */}
      <section className="py-24 px-6 bg-gradient-to-br from-amber-50 to-white">
        <div className="mx-auto max-w-5xl flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full mb-4">
              Golden Verified Tick
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1c1b33] tracking-tight mb-4">
              Your identity,<br />verified.
            </h2>
            <p className="text-[#65637e] leading-relaxed mb-6 max-w-md">
              The Golden Tick is a verified business badge displayed next to your name inside Sendora.
              It signals trust, authenticity, and that you operate a legitimate business email.
            </p>
            <ul className="space-y-2 text-sm text-[#1c1b33]">
              {["Shown in inbox list next to your name", "Visible on your email profile", "Only awarded to active Business plan users", "Removed automatically if plan lapses"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-amber-500 font-bold">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center gap-4">
            <img
              src="/golden-tick.jpg"
              alt="Golden Verified Tick"
              className="w-40 h-40 object-contain drop-shadow-2xl"
            />
            <div className="bg-white border border-amber-200 rounded-2xl px-6 py-4 text-center shadow-sm">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-[#6d4aff] flex items-center justify-center text-white text-xs font-bold">
                  Y
                </div>
                <span className="text-sm font-semibold text-[#1c1b33]">you@yourcompany.com</span>
                <img src="/golden-tick.jpg" alt="" className="w-4 h-4 object-contain" />
              </div>
              <div className="text-xs text-[#9896b4]">Business verified sender</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. PRICING ── */}
      <section id="pricing" className="py-24 px-6 bg-white">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1c1b33] tracking-tight mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-[#65637e] mb-12 max-w-lg mx-auto">
            Business and Professional bill separately. Subscriptions auto-renew. No hidden
            fees—cancel any time (access continues until the end of the paid period).
          </p>
          {error && (
            <p className="mb-6 text-sm text-red-600 max-w-lg mx-auto" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col lg:flex-row flex-wrap gap-6 justify-center">
            {/* Free card */}
            <div className="flex-1 max-w-sm bg-[#faf9fe] border border-[#e8e4f8] rounded-2xl p-8 text-left mx-auto md:mx-0">
              <div className="text-sm font-semibold text-[#65637e] mb-2">Free</div>
              <div className="text-4xl font-extrabold text-[#1c1b33] mb-1">₹0</div>
              <div className="text-sm text-[#9896b4] mb-6">Forever</div>
              <ul className="space-y-2.5 text-sm text-[#1c1b33]">
                {["user@sendora.me address", "1 GB storage", "Basic filters", "Standard delivery"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-[#9896b4]">–</span> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Link
                  href="/inbox"
                  className="block text-center rounded-full border border-[#e8e4f8] text-[#65637e] text-sm font-medium py-2.5 hover:border-[#6d4aff] hover:text-[#6d4aff] transition-colors"
                >
                  Current plan
                </Link>
              </div>
            </div>

            {/* Business card */}
            <div className="flex-1 max-w-sm bg-gradient-to-br from-[#6d4aff] to-[#5b3dff] rounded-2xl p-8 text-left shadow-2xl shadow-[#6d4aff]/30 relative mx-auto md:mx-0">
              <div className="absolute -top-3 left-8">
                <span className="bg-amber-400 text-[#1c1b33] text-xs font-bold px-3 py-1 rounded-full shadow">
                  Most Popular
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-white/80">Business</span>
                <img src="/golden-tick.jpg" alt="" className="w-4 h-4 object-contain" />
              </div>
              <div className="text-4xl font-extrabold text-white mb-1">{PLAN_AMOUNT_DISPLAY}</div>
              <div className="text-sm text-white/60 mb-6">per month</div>
              <ul className="space-y-2.5 text-sm text-white">
                {[
                  "Custom domain email",
                  "10 GB storage",
                  "Golden Verified Tick",
                  "Team mailboxes",
                  "Advanced automation",
                  "Priority delivery",
                  "No Sendora branding",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-amber-300 font-bold">✓</span> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6 space-y-2">
                {isBusiness ? (
                  <>
                    <div className="block text-center rounded-full bg-white/20 text-white text-sm font-semibold py-2.5">
                      Active
                    </div>
                    {planExpiresAt && (
                      <p className="text-center text-xs text-white/70">
                        Access until{" "}
                        {new Date(planExpiresAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    )}
                    <Link
                      href="/settings?section=business"
                      className="block w-full text-center rounded-full border border-white/50 text-white text-sm font-semibold py-2.5 hover:bg-white/10 transition-colors"
                    >
                      Manage
                    </Link>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleUpgrade()}
                    disabled={loadingPlan !== null}
                    className="block w-full text-center rounded-full bg-white text-[#6d4aff] text-sm font-bold py-2.5 hover:bg-amber-50 transition-colors disabled:opacity-60"
                  >
                    {loadingPlan === "business" ? "Processing…" : "Upgrade to Business"}
                  </button>
                )}
                {!isBusiness && (
                  <div className="mt-2">
                    <InternationalPaymentsRequest
                      initialEmail={email}
                      variant="purpleOutline"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Professional card */}
            <div className="flex-1 max-w-sm bg-white border border-[#e8e4f8] rounded-2xl p-8 text-left shadow-sm relative mx-auto md:mx-0">
              <div className="text-sm font-semibold text-[#65637e] mb-2">
                Professional · Coming Soon
              </div>
              <div className="text-4xl font-extrabold text-[#1c1b33] mb-1">
                {PRO_PLAN_AMOUNT_DISPLAY}
              </div>
              <div className="text-sm text-[#9896b4] mb-6">per month</div>
              <ul className="space-y-2.5 text-sm text-[#1c1b33]">
                {[
                  "No domain required",
                  "Personal branding identity",
                  "Fast setup in seconds",
                  "Great for creators and freelancers",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-[#6d4aff] font-bold">✓</span> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6 space-y-2">
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="block w-full text-center rounded-full bg-[#1c1b33] text-white text-sm font-bold py-2.5 opacity-60 cursor-not-allowed"
                >
                  Coming Soon
                </button>
                <p className="text-center text-xs text-[#9896b4]">
                  Professional Email will launch soon.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. COMPARISON TABLE ── */}
      <section className="py-16 px-6 bg-[#faf9fe]">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-[#1c1b33] text-center mb-8">Free vs Business</h2>
          <div className="bg-white rounded-2xl border border-[#e8e4f8] overflow-hidden">
            <div className="grid grid-cols-3 bg-[#1c1b33] text-white text-sm font-semibold">
              <div className="px-5 py-3 text-[#9896b4]">Feature</div>
              <div className="px-5 py-3 text-center">Free</div>
              <div className="px-5 py-3 text-center text-amber-400">Business</div>
            </div>
            {comparison.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-3 text-sm border-b border-[#f0edfb] last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-[#faf9fe]"}`}
              >
                <div className="px-5 py-3.5 font-medium text-[#1c1b33]">{row.feature}</div>
                <div className="px-5 py-3.5 text-center text-[#65637e]">
                  {typeof row.free === "boolean" ? (row.free ? "✓" : <span className="text-[#ccc]">—</span>) : row.free}
                </div>
                <div className="px-5 py-3.5 text-center font-semibold text-[#6d4aff]">
                  {typeof row.business === "boolean" ? (
                    row.business ? (
                      <span className="text-amber-500 font-bold">✓</span>
                    ) : (
                      <span className="text-[#ccc]">—</span>
                    )
                  ) : (
                    row.business
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. FAQ ── */}
      <section className="py-20 px-6 bg-white">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold text-[#1c1b33] text-center mb-10">Frequently asked questions</h2>
          <div className="space-y-3">
            {faq.map((item, i) => (
              <div key={i} className="border border-[#e8e4f8] rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold text-[#1c1b33] hover:bg-[#faf9fe] transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{item.q}</span>
                  <span className={`text-[#6d4aff] transition-transform ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-[#65637e] leading-relaxed border-t border-[#f0edfb] pt-3 bg-[#faf9fe]">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. FINAL CTA ── */}
      <section className="py-24 px-6 bg-gradient-to-br from-[#1c1b33] to-[#2d2b4e] text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
            Choose what you need
          </h2>
          <p className="text-[#9896b4] mb-8 leading-relaxed">
            Compare Business and Professional above—each plan has its own subscription and
            settings. You can add the other whenever you like.
          </p>
          <Link
            href="#pricing"
            className="inline-block rounded-full bg-white text-[#1c1b33] font-bold px-10 py-4 text-base hover:bg-[#f3f0fd] transition-colors"
          >
            Back to plans
          </Link>
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          <p className="mt-4 text-xs text-[#9896b4]">No commitment. Cancel any time.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1c1b33] border-t border-white/5 py-6 px-6 text-center">
        <p className="text-xs text-[#9896b4]">© {new Date().getFullYear()} Sendora. All rights reserved.</p>
      </footer>
    </div>
  );
}
