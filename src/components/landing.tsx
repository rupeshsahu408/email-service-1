"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const domain = process.env.NEXT_PUBLIC_EMAIL_DOMAIN ?? "auramail.app";

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-6 h-6">
        <rect x="2" y="4" width="20" height="16" rx="3" /><path d="m2 7 10 7 10-7" />
      </svg>
    ),
    title: "Private inbox",
    body: "A focused, three-pane inbox so you can read and reply without distraction. No ads, ever.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-6 h-6">
        <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    ),
    title: "End-to-end encryption",
    body: "Messages secured with modern encryption standards. Only you and your recipient can read your mail.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-6 h-6">
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
      </svg>
    ),
    title: "Instant delivery",
    body: "Lightning-fast email delivery with real-time inbox updates. Never miss an important message.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-6 h-6">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    title: "Privacy by design",
    body: "We collect only what is needed to run your inbox. No tracking pixels, no profiling.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-6 h-6">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    title: "Labels & organization",
    body: "Powerful labeling, starring, and filtering to keep your inbox effortlessly organized.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-6 h-6">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
    ),
    title: "Powerful search",
    body: "Find any message instantly with full-text search, attachment filters, and smart queries.",
  },
];

const securityPoints = [
  { icon: "🛡️", label: "Zero-knowledge architecture" },
  { icon: "🔐", label: "Modern password hashing" },
  { icon: "📵", label: "No phone number required" },
  { icon: "🚫", label: "No tracking or ads" },
  { icon: "⚡", label: "Rate limiting & bot protection" },
  { icon: "🔑", label: "Recovery key backup" },
];

const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    desc: "Everything you need to get started.",
    cta: "Create free account",
    ctaHref: "/signup",
    filled: false,
    features: [
      "1 GB storage",
      `1 ${domain} address`,
      "Privacy-first email",
      "Web access",
      "Labels & search",
    ],
  },
  {
    name: "Business",
    price: "₹199",
    period: "per month",
    desc: "Professional identity for serious work.",
    cta: "Upgrade to Business",
    ctaHref: "/upgrade",
    filled: true,
    badge: "Most popular",
    features: [
      "10 GB storage",
      "Custom domain email",
      "Golden Verified Tick",
      "Team inboxes",
      "Auto-pay subscription",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "contact us",
    desc: "Scale without limits for your organisation.",
    cta: "Contact Sales",
    ctaHref: "mailto:hello@sendora.me",
    filled: false,
    features: [
      "Unlimited storage",
      "Unlimited addresses",
      "Dedicated support",
      "SLA guarantee",
      "Custom integrations",
    ],
  },
];

function useCountUp(target: number, duration = 2200, startOnMount = false) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(startOnMount);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!startOnMount) {
      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setStarted(true); },
        { threshold: 0.3 }
      );
      if (ref.current) observer.observe(ref.current);
      return () => observer.disconnect();
    }
  }, [startOnMount]);

  useEffect(() => {
    if (!started) return;
    const startTime = performance.now();
    const frame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [started, target, duration]);

  return { count, ref };
}

const trustStats = [
  { value: "99.9%", label: "Uptime SLA" },
  { value: "150+", label: "Countries Served" },
  { value: "< 1s", label: "Avg. Delivery Time" },
];

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { count, ref: trustRef } = useCountUp(25);

  return (
    <div className="flex flex-col min-h-screen bg-white text-[#1c1b33]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#e8e4f8]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <img src="/sendora-logo.png" alt="Sendora" className="w-8 h-8 object-contain" />
            <span className="text-[15px] font-bold tracking-tight text-[#1c1b33]">Sendora</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-[#65637e]">
            <a href="#features" className="hover:text-[#6d4aff] transition-colors">Features</a>
            <a href="#security" className="hover:text-[#6d4aff] transition-colors">Security</a>
            <a href="#pricing" className="hover:text-[#6d4aff] transition-colors">Pricing</a>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-[#65637e] hover:text-[#6d4aff] transition-colors">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[#6d4aff] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#6d4aff]/30 hover:bg-[#5b3dff] transition-colors"
            >
              Create free account
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-[#65637e] hover:text-[#1c1b33] hover:bg-[#f3f0fd] transition-all"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#e8e4f8] bg-white px-6 py-4 space-y-1">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-sm font-medium text-[#65637e] hover:text-[#6d4aff] transition-colors"
            >
              Features
            </a>
            <a
              href="#security"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-sm font-medium text-[#65637e] hover:text-[#6d4aff] transition-colors"
            >
              Security
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-sm font-medium text-[#65637e] hover:text-[#6d4aff] transition-colors"
            >
              Pricing
            </a>
            <div className="pt-3 border-t border-[#f0edfb] flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2.5 text-sm font-semibold text-[#6d4aff] hover:bg-[#f3f0fd] rounded-xl transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center rounded-full bg-[#6d4aff] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5b3dff] transition-colors"
              >
                Create free account
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-white via-[#f8f5ff] to-[#f3f0fd] px-6 pt-20 pb-28">
          {/* Background blobs */}
          <div className="pointer-events-none absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#c4b5fd]/20 blur-[120px]" />
          <div className="pointer-events-none absolute top-20 -left-32 w-[400px] h-[400px] rounded-full bg-[#a78bfa]/15 blur-[100px]" />
          <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[200px] rounded-full bg-[#818cf8]/10 blur-[80px]" />

          <div className="relative mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d4cafe] bg-white/80 px-3.5 py-1.5 text-xs font-medium text-[#6d4aff] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6d4aff] animate-pulse" />
              Privacy-first email platform
            </div>

            <h1 className="animate-fade-in-up text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#1c1b33] leading-[1.1]">
              Email that respects<br />
              <span className="text-[#6d4aff]">your privacy</span>
            </h1>

            <p className="animate-fade-in-up mt-6 mx-auto max-w-2xl text-base sm:text-lg text-[#65637e] leading-relaxed" style={{ animationDelay: "0.1s" }}>
              Take control of your inbox with end-to-end encryption, zero tracking, and a beautiful interface built for focus — not distraction.
            </p>

            <div className="animate-fade-in-up mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4" style={{ animationDelay: "0.2s" }}>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-[#6d4aff] px-6 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-white shadow-lg shadow-[#6d4aff]/30 hover:bg-[#5b3dff] transition-all hover:shadow-xl hover:shadow-[#6d4aff]/40"
              >
                Create free account
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" /></svg>
              </Link>
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 rounded-full border border-[#d4cafe] bg-white px-6 sm:px-7 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-[#6d4aff] hover:bg-[#f3f0fd] transition-colors"
              >
                Compare plans
              </a>
            </div>

            {/* App preview mockup */}
            <div className="mt-16 mx-auto max-w-3xl">
              <div className="rounded-2xl border border-[#e8e4f8] bg-white shadow-2xl shadow-[#6d4aff]/10 overflow-hidden">
                {/* Mockup top bar */}
                <div className="flex items-center gap-1.5 px-4 py-3 bg-[#1c1b33]">
                  <div className="w-3 h-3 rounded-full bg-red-400/60" />
                  <div className="w-3 h-3 rounded-full bg-amber-400/60" />
                  <div className="w-3 h-3 rounded-full bg-green-400/60" />
                  <div className="flex-1 mx-4">
                    <div className="w-48 mx-auto h-5 rounded bg-white/10 flex items-center justify-center">
                      <span className="text-white/50 text-[10px]">mail.{domain}</span>
                    </div>
                  </div>
                </div>
                {/* Mockup content */}
                <div className="flex h-48 text-left">
                  <div className="w-36 sm:w-40 bg-[#1c1b33] flex flex-col gap-1 p-3">
                    {["Inbox", "Drafts", "Sent", "Starred", "Trash"].map((f, i) => (
                      <div key={f} className={`rounded px-2 py-1 text-[11px] ${i === 0 ? "bg-[#6d4aff]/40 text-white" : "text-white/40"}`}>{f}</div>
                    ))}
                  </div>
                  <div className="w-44 sm:w-52 border-r border-[#f0edfb] flex flex-col">
                    {["Welcome to Sendora", "Your account is ready", "Getting started guide"].map((s, i) => (
                      <div key={s} className={`px-3 py-2.5 border-b border-[#f0edfb] ${i === 0 ? "bg-[#ede8ff]" : ""}`}>
                        <div className="text-[11px] font-semibold text-[#1c1b33] truncate">{s}</div>
                        <div className="text-[10px] text-[#9896b4] mt-0.5">Sendora Team</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 p-4 flex flex-col gap-2 min-w-0">
                    <div className="h-3 bg-[#f3f0fd] rounded w-3/4" />
                    <div className="h-3 bg-[#f3f0fd] rounded w-full" />
                    <div className="h-3 bg-[#f3f0fd] rounded w-5/6" />
                    <div className="h-3 bg-[#f3f0fd] rounded w-2/3 mt-2" />
                    <div className="h-3 bg-[#f3f0fd] rounded w-full" />
                    <div className="h-3 bg-[#f3f0fd] rounded w-4/5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust strip ── */}
        <section className="border-y border-[#e8e4f8] bg-white px-6 py-5">
          <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-center gap-5 sm:gap-8 text-sm text-[#65637e]">
            {[
              { icon: "🔐", text: "End-to-end encrypted" },
              { icon: "📵", text: "No phone number required" },
              { icon: "🚫", text: "Zero tracking or ads" },
              { icon: "⚡", text: "Lightning-fast delivery" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-2">
                <span>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── User Trust / Social Proof ── */}
        <section ref={trustRef} className="relative overflow-hidden bg-[#0e0c22] px-6 py-16 sm:py-20">
          {/* Ambient glow blobs */}
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full bg-[#6d4aff]/20 blur-[120px]" />
          <div className="pointer-events-none absolute bottom-0 left-1/4 w-[300px] h-[200px] rounded-full bg-[#a78bfa]/10 blur-[80px]" />
          <div className="pointer-events-none absolute bottom-0 right-1/4 w-[300px] h-[200px] rounded-full bg-[#818cf8]/10 blur-[80px]" />

          <div className="relative mx-auto max-w-5xl text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#6d4aff]/30 bg-[#6d4aff]/10 px-4 py-1.5 text-xs font-semibold text-[#a78bfa] tracking-widest uppercase mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] animate-pulse" />
              Globally trusted
            </div>

            {/* Big counter */}
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <p className="text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-[#a78bfa] via-[#818cf8] to-[#6d4aff] bg-clip-text text-transparent tabular-nums">
                  {count}M+
                </span>
              </p>
            </div>

            {/* Label */}
            <p className="mt-4 text-lg sm:text-2xl font-semibold text-white/90 tracking-tight">
              Users Worldwide <span className="not-italic">🌍</span>
            </p>
            <p className="mt-3 mx-auto max-w-md text-sm sm:text-base text-white/40 leading-relaxed">
              Millions of people around the globe trust Sendora to keep their emails private, fast, and ad-free.
            </p>

            {/* Divider */}
            <div className="mt-12 border-t border-white/[0.07]" />

            {/* Supporting stats */}
            <div className="mt-10 grid grid-cols-3 gap-4 sm:gap-8 max-w-lg mx-auto">
              {trustStats.map(({ value, label }) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <span className="text-xl sm:text-2xl font-bold text-white">{value}</span>
                  <span className="text-[11px] sm:text-xs text-white/40 text-center leading-snug">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="px-6 py-20 sm:py-24 bg-[#f8f5ff]">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-12 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1c1b33] tracking-tight">
                Everything you need, nothing you don&apos;t
              </h2>
              <p className="mt-4 mx-auto max-w-xl text-[#65637e] text-sm sm:text-base">
                A thoughtfully designed email experience focused on speed, privacy, and clarity.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-[#e8e4f8] bg-white p-6 shadow-sm hover:shadow-md hover:border-[#c4b5fd] transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#f3f0fd] text-[#6d4aff] flex items-center justify-center mb-4">
                    {f.icon}
                  </div>
                  <h3 className="text-base font-semibold text-[#1c1b33]">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#65637e]">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Security section ── */}
        <section id="security" className="px-6 py-20 sm:py-24 bg-white">
          <div className="mx-auto max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#6d4aff] uppercase tracking-widest mb-4">
                  <span className="w-6 h-px bg-[#6d4aff]" />
                  Security first
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1c1b33] tracking-tight leading-tight">
                  Built with privacy<br />at the core
                </h2>
                <p className="mt-5 text-[#65637e] leading-relaxed text-sm sm:text-base">
                  Unlike free mail services that monetize your data, Sendora is designed from the ground up to protect your information. Your password is hashed with modern cryptography, your messages are yours alone, and we never show you ads.
                </p>
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {securityPoints.map(({ icon, label }) => (
                    <div key={label} className="flex items-center gap-2.5 text-sm text-[#1c1b33]">
                      <span className="text-base">{icon}</span>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/signup"
                  className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#1c1b33] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#6d4aff] transition-colors"
                >
                  Get started free
                </Link>
              </div>
              <div className="rounded-2xl bg-[#1c1b33] p-6 sm:p-8 text-white">
                <div className="space-y-4">
                  {[
                    { step: "01", title: "Choose your address", desc: `Pick a unique @${domain} username` },
                    { step: "02", title: "Verify you're human", desc: "Quick CAPTCHA to prevent abuse" },
                    { step: "03", title: "Set a strong password", desc: "Hashed securely — we never see it" },
                    { step: "04", title: "Save your recovery key", desc: "Your only backup — keep it safe" },
                  ].map(({ step, title, desc }) => (
                    <div key={step} className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-[#6d4aff]/30 text-[#a78bfa] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {step}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{title}</div>
                        <div className="text-xs text-white/50 mt-0.5">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="px-6 py-20 sm:py-24 bg-[#f8f5ff]">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-12 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1c1b33] tracking-tight">
                Simple, transparent pricing
              </h2>
              <p className="mt-4 text-[#65637e] text-sm sm:text-base">No hidden fees. No ads. Upgrade or downgrade anytime.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl p-6 sm:p-7 flex flex-col ${
                    plan.filled
                      ? "bg-[#6d4aff] text-white shadow-xl shadow-[#6d4aff]/30"
                      : "bg-white border border-[#e8e4f8] shadow-sm"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#f0c34b] text-[#1c1b33] text-xs font-bold px-3 py-1 whitespace-nowrap">
                      {plan.badge}
                    </div>
                  )}
                  <div>
                    <div className={`text-sm font-semibold uppercase tracking-wider ${plan.filled ? "text-white/70" : "text-[#6d4aff]"}`}>
                      {plan.name}
                    </div>
                    <div className="flex items-end gap-1 mt-2">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className={`text-sm pb-1 ${plan.filled ? "text-white/60" : "text-[#65637e]"}`}>/ {plan.period}</span>
                    </div>
                    <p className={`mt-2 text-sm ${plan.filled ? "text-white/70" : "text-[#65637e]"}`}>{plan.desc}</p>
                  </div>
                  <ul className="mt-6 space-y-2.5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 shrink-0 ${plan.filled ? "text-white/80" : "text-[#6d4aff]"}`}>
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                        </svg>
                        <span className={plan.filled ? "text-white/90" : "text-[#1c1b33]"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.ctaHref}
                    className={`mt-8 block text-center rounded-full py-2.5 text-sm font-semibold transition-all ${
                      plan.filled
                        ? "bg-white text-[#6d4aff] hover:bg-[#f3f0fd]"
                        : "bg-[#6d4aff] text-white hover:bg-[#5b3dff] shadow-sm"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="relative px-6 py-20 sm:py-24 bg-[#1c1b33] overflow-hidden">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-[600px] h-[300px] rounded-full bg-[#6d4aff]/15 blur-[100px]" />
          </div>
          <div className="relative mx-auto max-w-3xl text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
              Start protecting your privacy today
            </h2>
            <p className="mt-4 text-white/60 text-base sm:text-lg">
              Free forever. No credit card. No phone number. Just your @{domain} address.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#6d4aff] px-7 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-white shadow-lg shadow-[#6d4aff]/40 hover:bg-[#7d5fff] transition-all"
            >
              Create your free account
            </Link>
            <p className="mt-4 text-white/30 text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-white/60 hover:text-white underline underline-offset-2 transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-[#080710] border-t border-white/[0.06]">

        {/* Main grid */}
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-10 grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">

          {/* Column 1 — Brand */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-1 flex flex-col gap-5">
            <div className="flex items-center gap-2.5">
              <img src="/sendora-logo.png" alt="Sendora" className="w-8 h-8 object-contain" />
              <span className="text-base font-semibold text-white tracking-tight">Sendora</span>
            </div>
            <p className="text-sm text-white/45 leading-relaxed max-w-[220px]">
              Modern email experience,<br className="hidden sm:block" /> reimagined.
            </p>
            <a
              href="mailto:support@sendora.me"
              className="inline-flex items-center gap-2 text-sm text-[#7c6aff] hover:text-[#a78bff] transition-colors group w-fit"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                <rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 10 7 10-7"/>
              </svg>
              support@sendora.me
            </a>
          </div>

          {/* Column 2 — Product */}
          <div className="flex flex-col gap-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/35">
              Product
            </p>
            <nav className="flex flex-col gap-3">
              {[
                { label: "Features",          href: "#features" },
                { label: "Pricing",           href: "#pricing"  },
                { label: "Temporary Inbox",   href: "/temp-inbox" },
                { label: "Business Email",    href: "/signup"    },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="text-sm text-white/50 hover:text-white/90 transition-colors w-fit"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>

          {/* Column 3 — Company */}
          <div className="flex flex-col gap-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/35">
              Company
            </p>
            <nav className="flex flex-col gap-3">
              {[
                { label: "About",             href: "#" },
                { label: "Contact",           href: "mailto:support@sendora.me" },
                { label: "Privacy Policy",    href: "#" },
                { label: "Terms & Conditions",href: "#" },
                { label: "Security 🔐",       href: "#" },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="text-sm text-white/50 hover:text-white/90 transition-colors w-fit"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>

          {/* Column 4 — Resources */}
          <div className="flex flex-col gap-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/35">
              Resources
            </p>
            <nav className="flex flex-col gap-3">
              {[
                { label: "Help Center", href: "#" },
                { label: "Blog",        href: "#", badge: "Soon" },
                { label: "Status",      href: "#", badge: "Soon" },
              ].map(({ label, href, badge }) => (
                <a
                  key={label}
                  href={href}
                  className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/90 transition-colors w-fit"
                >
                  {label}
                  {badge && (
                    <span className="text-[0.6rem] font-medium px-1.5 py-0.5 rounded-full bg-white/[0.07] text-white/40 border border-white/[0.08] leading-none">
                      {badge}
                    </span>
                  )}
                </a>
              ))}
            </nav>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-auto max-w-6xl px-6">
          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />
        </div>

        {/* Bottom bar */}
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">

          {/* Left — copyright */}
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left">
            <p className="text-xs text-white/30">
              © {new Date().getFullYear()} Sendora. All rights reserved.
            </p>
            <span className="hidden sm:inline text-white/15">·</span>
            <p className="text-xs text-white/20">
              Built for speed, privacy, and simplicity.
            </p>
          </div>

          {/* Right — social icons */}
          <div className="flex items-center gap-4">
            {/* Twitter / X */}
            <a
              href="#"
              aria-label="Sendora on X (Twitter)"
              className="text-white/30 hover:text-white/75 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.254 5.622 5.91-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>

            {/* LinkedIn */}
            <a
              href="#"
              aria-label="Sendora on LinkedIn"
              className="text-white/30 hover:text-white/75 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>

            {/* GitHub */}
            <a
              href="#"
              aria-label="Sendora on GitHub"
              className="text-white/30 hover:text-white/75 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
