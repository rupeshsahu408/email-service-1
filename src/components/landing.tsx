"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { BrandsMarquee } from "@/components/brands-marquee";
import { LanguageProvider, useLanguage } from "@/components/language-context";
import { LanguageSelector } from "@/components/language-selector";

const domain = process.env.NEXT_PUBLIC_EMAIL_DOMAIN ?? "auramail.app";

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="2" y="4" width="20" height="16" rx="3" /><path d="m2 7 10 7 10-7" />
      </svg>
    ),
    title: "Private inbox",
    body: "A focused, three-pane inbox so you can read and reply without distraction. No ads, ever.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    ),
    title: "End-to-end encryption",
    body: "Messages secured with modern encryption standards. Only you and your recipient can read your mail.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
      </svg>
    ),
    title: "Instant delivery",
    body: "Lightning-fast email delivery with real-time inbox updates. Never miss an important message.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "Privacy by design",
    body: "We collect only what is needed to run your inbox. No tracking pixels, no profiling.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
    title: "Labels & organisation",
    body: "Powerful labeling, starring, and filtering to keep your inbox effortlessly organised.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
    ),
    title: "Powerful search",
    body: "Find any message instantly with full-text search, attachment filters, and smart queries.",
  },
];

const securityPoints = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    label: "Zero-knowledge architecture",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    ),
    label: "Modern password hashing",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" /><line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    ),
    label: "No phone number required",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    ),
    label: "No tracking or ads",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    label: "Rate limiting & bot protection",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
    ),
    label: "Recovery key backup",
  },
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

const testimonials = [
  {
    body: "Sendora completely changed how I think about email. It's fast, clean, and I finally feel like my inbox is private. I'll never go back to Gmail.",
    name: "Arjun Mehta",
    role: "Founder, TechLaunch",
    initials: "AM",
    color: "from-[#6d4aff] to-[#a78bfa]",
  },
  {
    body: "The custom domain feature is a game changer for small businesses. Setup took under five minutes and everything just worked perfectly.",
    name: "Priya Sharma",
    role: "Designer & Freelancer",
    initials: "PS",
    color: "from-[#0ea5e9] to-[#6d4aff]",
  },
  {
    body: "Finally an email service that doesn't treat me like the product. The temporary inbox feature alone is worth it — brilliant for OTPs and sign-ups.",
    name: "Rahul Nair",
    role: "Software Engineer",
    initials: "RN",
    color: "from-[#10b981] to-[#0ea5e9]",
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
  return (
    <LanguageProvider>
      <LandingPageInner />
    </LanguageProvider>
  );
}

function LandingPageInner() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { count, ref: trustRef } = useCountUp(25);
  const { t } = useLanguage();

  return (
    <div className="flex flex-col min-h-screen bg-white text-[#1c1b33]">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#e8e4f8]/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <img src="/sendora-logo.png" alt="Sendora" className="w-8 h-8 object-contain" />
            <span className="text-[15px] font-bold tracking-tight text-[#1c1b33]">Sendora</span>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-[#65637e]">
            <a href="#features" className="hover:text-[#6d4aff] transition-colors duration-200">{t.navFeatures}</a>
            <a href="#security" className="hover:text-[#6d4aff] transition-colors duration-200">{t.navSecurity}</a>
            <a href="#pricing" className="hover:text-[#6d4aff] transition-colors duration-200">{t.navPricing}</a>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <LanguageSelector variant="navbar" />
            <Link href="/login" className="text-[13px] font-medium text-[#65637e] hover:text-[#6d4aff] transition-colors duration-200 px-1">
              {t.signIn}
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[#6d4aff] px-5 py-2 text-[13px] font-semibold text-white shadow-md shadow-[#6d4aff]/25 hover:bg-[#5b3dff] hover:shadow-lg hover:shadow-[#6d4aff]/35 transition-all duration-200"
            >
              {t.getStarted}
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

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#e8e4f8] bg-white px-6 py-4 space-y-1">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 text-sm font-medium text-[#65637e] hover:text-[#6d4aff] transition-colors">{t.navFeatures}</a>
            <a href="#security" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 text-sm font-medium text-[#65637e] hover:text-[#6d4aff] transition-colors">{t.navSecurity}</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block py-2.5 text-sm font-medium text-[#65637e] hover:text-[#6d4aff] transition-colors">{t.navPricing}</a>
            <div className="pt-3 border-t border-[#f0edfb] flex flex-col gap-2">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block text-center py-2.5 text-sm font-semibold text-[#6d4aff] hover:bg-[#f3f0fd] rounded-xl transition-colors">{t.signIn}</Link>
              <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="block text-center rounded-full bg-[#6d4aff] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5b3dff] transition-colors">{t.getStarted}</Link>
            </div>
            <LanguageSelector variant="mobile" />
          </div>
        )}
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#fdfcff] via-[#f8f5ff] to-[#f0ecfd] px-6 pt-20 pb-32">
          {/* Background blobs */}
          <div className="pointer-events-none absolute -top-32 -right-32 w-[700px] h-[700px] rounded-full bg-[#c4b5fd]/20 blur-[130px]" />
          <div className="pointer-events-none absolute top-10 -left-40 w-[500px] h-[500px] rounded-full bg-[#a78bfa]/12 blur-[110px]" />
          <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[220px] rounded-full bg-[#818cf8]/10 blur-[90px]" />

          {/* Subtle dot grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: "radial-gradient(circle, #6d4aff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
          />

          <div className="relative mx-auto max-w-4xl text-center">

            {/* Announcement badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d4cafe]/80 bg-white/90 px-4 py-1.5 text-[11px] font-semibold text-[#6d4aff] mb-8 shadow-sm shadow-[#6d4aff]/10 tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6d4aff] animate-pulse" />
              Privacy-first email platform
            </div>

            {/* Headline */}
            <h1 className="animate-fade-in-up text-4xl sm:text-6xl lg:text-[4.5rem] font-extrabold tracking-[-0.02em] text-[#1c1b33] leading-[1.08]">
              Email that works<br />
              <span className="bg-gradient-to-r from-[#6d4aff] via-[#8b5cf6] to-[#a78bfa] bg-clip-text text-transparent">
                for you, not against you
              </span>
            </h1>

            <p className="animate-fade-in-up mt-6 mx-auto max-w-xl text-base sm:text-[1.05rem] text-[#65637e] leading-relaxed" style={{ animationDelay: "0.08s" }}>
              Take control of your inbox with end-to-end encryption, zero tracking, and a beautiful interface built for focus — not distraction.
            </p>

            {/* CTAs */}
            <div className="animate-fade-in-up mt-10 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "0.16s" }}>
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2.5 rounded-full bg-[#6d4aff] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#6d4aff]/35 hover:bg-[#5b3dff] hover:shadow-xl hover:shadow-[#6d4aff]/45 transition-all duration-200"
              >
                Create free account
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                </svg>
              </Link>
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 rounded-full border border-[#d4cafe] bg-white px-6 py-3.5 text-sm font-semibold text-[#6d4aff] hover:bg-[#f3f0fd] hover:border-[#b8a4f8] transition-all duration-200"
              >
                Compare plans
              </a>
            </div>

            {/* Social proof strip */}
            <div className="animate-fade-in-up mt-10 flex items-center justify-center gap-3" style={{ animationDelay: "0.24s" }}>
              <div className="flex -space-x-2">
                {["from-violet-400 to-purple-600", "from-blue-400 to-indigo-600", "from-emerald-400 to-teal-600", "from-rose-400 to-pink-600"].map((g, i) => (
                  <div key={i} className={`w-7 h-7 rounded-full bg-gradient-to-br ${g} border-2 border-white flex items-center justify-center text-white text-[9px] font-bold`}>
                    {["A","R","P","K"][i]}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[13px] text-[#65637e]">
                <div className="flex gap-0.5">
                  {[0,1,2,3,4].map(i => (
                    <svg key={i} viewBox="0 0 12 12" fill="#f59e0b" className="w-3 h-3">
                      <path d="M6 1l1.39 2.82L10.5 4.27l-2.25 2.19.53 3.09L6 8.02 3.22 9.55l.53-3.09L1.5 4.27l3.11-.45L6 1z"/>
                    </svg>
                  ))}
                </div>
                <span className="font-semibold text-[#1c1b33]">4.9</span>
                <span>— Loved by 25M+ users</span>
              </div>
            </div>

            {/* App preview mockup */}
            <div className="mt-16 mx-auto max-w-3xl animate-fade-in-up" style={{ animationDelay: "0.32s" }}>
              <div className="rounded-2xl border border-[#e0d9f8] bg-white shadow-2xl shadow-[#6d4aff]/12 overflow-hidden">
                {/* Window bar */}
                <div className="flex items-center gap-1.5 px-4 py-3 bg-[#13111f] border-b border-white/[0.06]">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
                  <div className="flex-1 mx-4">
                    <div className="w-44 mx-auto h-5 rounded-md bg-white/[0.07] flex items-center justify-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400/60" />
                      <span className="text-white/40 text-[10px] font-mono">mail.{domain}</span>
                    </div>
                  </div>
                </div>
                {/* Mockup body */}
                <div className="flex h-52 text-left">
                  <div className="w-36 sm:w-40 bg-[#1c1b33] flex flex-col gap-0.5 p-3 pt-2">
                    <div className="text-[9px] font-semibold text-white/20 uppercase tracking-widest px-2 mb-1">Mailboxes</div>
                    {["Inbox", "Drafts", "Sent", "Starred", "Trash"].map((f, i) => (
                      <div key={f} className={`rounded-lg px-2.5 py-1.5 text-[11px] flex items-center gap-1.5 ${i === 0 ? "bg-[#6d4aff]/50 text-white font-medium" : "text-white/35 hover:text-white/60"}`}>
                        {i === 0 && <span className="w-1 h-1 rounded-full bg-[#a78bfa]" />}
                        {f}
                        {i === 0 && <span className="ml-auto text-[9px] bg-[#6d4aff] rounded-full px-1.5 py-0.5 text-white/90">3</span>}
                      </div>
                    ))}
                  </div>
                  <div className="w-44 sm:w-52 border-r border-[#f0edfb] flex flex-col overflow-hidden">
                    {["Welcome to Sendora", "Your account is ready", "Getting started guide"].map((s, i) => (
                      <div key={s} className={`px-3 py-3 border-b border-[#f0edfb] ${i === 0 ? "bg-[#ede8ff]" : "hover:bg-[#f9f8ff]"}`}>
                        <div className="flex justify-between items-start gap-1">
                          <div className="text-[11px] font-semibold text-[#1c1b33] truncate">{s}</div>
                          {i === 0 && <div className="w-1.5 h-1.5 rounded-full bg-[#6d4aff] shrink-0 mt-1" />}
                        </div>
                        <div className="text-[10px] text-[#9896b4] mt-0.5">Sendora Team</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 p-4 flex flex-col gap-2.5 min-w-0 bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <div className="h-2.5 bg-[#f3f0fd] rounded-full w-1/2" />
                      <div className="h-4 w-4 rounded-full bg-[#6d4aff]/20" />
                    </div>
                    <div className="h-2 bg-[#f3f0fd] rounded-full w-full" />
                    <div className="h-2 bg-[#f3f0fd] rounded-full w-5/6" />
                    <div className="h-2 bg-[#f3f0fd] rounded-full w-4/5" />
                    <div className="h-2 bg-[#f3f0fd] rounded-full w-2/3 mt-1" />
                    <div className="h-2 bg-[#f3f0fd] rounded-full w-full" />
                    <div className="h-2 bg-[#f3f0fd] rounded-full w-3/4" />
                    <div className="mt-auto flex gap-2">
                      <div className="h-6 flex-1 rounded-full bg-[#6d4aff]/15" />
                      <div className="h-6 w-6 rounded-full bg-[#f3f0fd]" />
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-[#9896b4] text-center tracking-wide">The clean, focused Sendora inbox</p>
            </div>
          </div>
        </section>

        {/* ── Trust strip ── */}
        <section className="border-y border-[#e8e4f8] bg-white px-6 py-4">
          <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {[
              {
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#6d4aff]"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>,
                text: "End-to-end encrypted",
              },
              {
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#6d4aff]"><path d="M17 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>,
                text: "No phone number required",
              },
              {
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#6d4aff]"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>,
                text: "Zero tracking or ads",
              },
              {
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#6d4aff]"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>,
                text: "Lightning-fast delivery",
              },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-[13px] font-medium text-[#65637e]">
                {icon}
                <span>{text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Brands That Trust Us ── */}
        <BrandsMarquee />

        {/* ── User Trust / Social Proof ── */}
        <section ref={trustRef} className="relative overflow-hidden bg-[#0e0c22] px-6 py-16 sm:py-24">
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[800px] h-[350px] rounded-full bg-[#6d4aff]/18 blur-[130px]" />
          <div className="pointer-events-none absolute bottom-0 left-1/4 w-[300px] h-[200px] rounded-full bg-[#a78bfa]/10 blur-[80px]" />
          <div className="pointer-events-none absolute bottom-0 right-1/4 w-[300px] h-[200px] rounded-full bg-[#818cf8]/10 blur-[80px]" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)", backgroundSize: "32px 32px" }}
          />

          <div className="relative mx-auto max-w-5xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#6d4aff]/30 bg-[#6d4aff]/10 px-4 py-1.5 text-[10px] font-bold text-[#a78bfa] tracking-[0.2em] uppercase mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] animate-pulse" />
              Globally trusted
            </div>

            <p className="mb-10 text-[12px] sm:text-[13px] font-medium tracking-[0.2em] uppercase text-white/25">
              Built in India.&nbsp;&nbsp;Designed for the World.
            </p>

            <p className="text-6xl sm:text-8xl lg:text-9xl font-extrabold tracking-tight bg-gradient-to-r from-[#a78bfa] via-[#818cf8] to-[#6d4aff] bg-clip-text text-transparent tabular-nums">
              {count}M+
            </p>

            <p className="mt-5 text-xl sm:text-2xl font-semibold text-white/90 tracking-tight">
              Users Worldwide 🌍
            </p>
            <p className="mt-3 mx-auto max-w-md text-sm sm:text-base text-white/35 leading-relaxed">
              Millions of people around the globe trust Sendora to keep their emails private, fast, and ad-free.
            </p>

            <div className="mt-12 border-t border-white/[0.06]" />

            <div className="mt-10 grid grid-cols-3 gap-4 sm:gap-8 max-w-lg mx-auto">
              {trustStats.map(({ value, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <span className="text-2xl sm:text-3xl font-bold text-white">{value}</span>
                  <span className="text-[11px] text-white/35 text-center leading-snug">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Rating & Trust Badges ── */}
        <section className="bg-white border-b border-[#ede9f8] px-6 py-12 sm:py-16">
          <div className="mx-auto max-w-5xl flex flex-col items-center gap-10">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-1">
                {[0,1,2,3,4].map((i) => (
                  <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-[#f59e0b]">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-[13px] font-semibold tracking-wide text-[#65637e]">
                Rated <span className="text-[#1c1b33]">4.9 / 5</span> by our users
              </p>
            </div>
            <div className="w-full max-w-xs border-t border-[#ede9f8]" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 w-full max-w-3xl">
              {[
                { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>, label: "Secure & Encrypted", sub: "End-to-end by default" },
                { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, label: "99.9% Uptime", sub: "Always-on infrastructure" },
                { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="2" y="4" width="20" height="16" rx="3" /><path d="m2 7 10 7 10-7" /></svg>, label: "No Spam Guarantee", sub: "Intelligent filtering" },
                { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>, label: "24/7 Support", sub: "Real help, anytime" },
              ].map(({ icon, label, sub }) => (
                <div key={label} className="group flex flex-col items-center gap-3 rounded-2xl border border-[#ede9f8] bg-white px-4 py-5 text-center hover:border-[#c4b5fd] hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#f3f0ff] text-[#6d4aff] group-hover:bg-[#6d4aff] group-hover:text-white transition-all duration-300">
                    {icon}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#1c1b33] leading-snug">{label}</p>
                    <p className="mt-0.5 text-[11px] text-[#9896b4] leading-snug">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section className="bg-[#f8f5ff] px-6 py-20 sm:py-24 border-b border-[#ede9f8]">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 text-[10px] font-bold text-[#6d4aff] uppercase tracking-[0.22em] mb-3">
                <span className="w-5 h-px bg-[#6d4aff]" />
                What users say
                <span className="w-5 h-px bg-[#6d4aff]" />
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1c1b33] tracking-tight">
                Trusted by people who care<br className="hidden sm:block" /> about their privacy
              </h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-5 sm:gap-6">
              {testimonials.map(({ body, name, role, initials, color }) => (
                <div key={name} className="group flex flex-col gap-5 rounded-2xl border border-[#e8e4f8] bg-white p-6 shadow-sm hover:shadow-md hover:border-[#c4b5fd] transition-all duration-300">
                  <div className="flex gap-0.5">
                    {[0,1,2,3,4].map(i => (
                      <svg key={i} viewBox="0 0 12 12" fill="#f59e0b" className="w-3.5 h-3.5">
                        <path d="M6 1l1.39 2.82L10.5 4.27l-2.25 2.19.53 3.09L6 8.02 3.22 9.55l.53-3.09L1.5 4.27l3.11-.45L6 1z"/>
                      </svg>
                    ))}
                  </div>
                  <p className="text-sm text-[#65637e] leading-relaxed flex-1">&ldquo;{body}&rdquo;</p>
                  <div className="flex items-center gap-3 pt-1 border-t border-[#f0edfb]">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {initials}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#1c1b33]">{name}</p>
                      <p className="text-[11px] text-[#9896b4]">{role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="px-6 py-20 sm:py-24 bg-white">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-12 sm:mb-16">
              <div className="inline-flex items-center gap-2 text-[10px] font-bold text-[#6d4aff] uppercase tracking-[0.22em] mb-3">
                <span className="w-5 h-px bg-[#6d4aff]" />
                Features
                <span className="w-5 h-px bg-[#6d4aff]" />
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1c1b33] tracking-tight">
                Everything you need,<br className="hidden sm:block" /> nothing you don&apos;t
              </h2>
              <p className="mt-4 mx-auto max-w-lg text-[#65637e] text-sm sm:text-base">
                A thoughtfully designed email experience focused on speed, privacy, and clarity.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group relative rounded-2xl border border-[#e8e4f8] bg-white p-6 shadow-sm hover:shadow-lg hover:border-[#c4b5fd] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                >
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-[#6d4aff]/[0.03] to-transparent" />
                  <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#f3f0fd] to-[#ede8ff] text-[#6d4aff] flex items-center justify-center mb-5 group-hover:from-[#6d4aff] group-hover:to-[#5b3dff] group-hover:text-white transition-all duration-300">
                    {f.icon}
                  </div>
                  <h3 className="relative text-[15px] font-semibold text-[#1c1b33]">{f.title}</h3>
                  <p className="relative mt-2 text-[13px] leading-relaxed text-[#65637e]">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Security section ── */}
        <section id="security" className="px-6 py-20 sm:py-24 bg-[#f8f5ff]">
          <div className="mx-auto max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 text-[10px] font-bold text-[#6d4aff] uppercase tracking-[0.22em] mb-5">
                  <span className="w-5 h-px bg-[#6d4aff]" />
                  Security first
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1c1b33] tracking-tight leading-tight">
                  Built with privacy<br />at the core
                </h2>
                <p className="mt-5 text-[#65637e] leading-relaxed text-sm sm:text-base">
                  Unlike free mail services that monetize your data, Sendora is designed from the ground up to protect your information. Your password is hashed with modern cryptography, your messages are yours alone, and we never show you ads.
                </p>
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {securityPoints.map(({ icon, label }) => (
                    <div key={label} className="flex items-center gap-3 text-sm text-[#1c1b33]">
                      <div className="w-7 h-7 rounded-lg bg-[#6d4aff]/10 text-[#6d4aff] flex items-center justify-center shrink-0">
                        {icon}
                      </div>
                      <span className="font-medium text-[13px]">{label}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/signup"
                  className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#1c1b33] px-6 py-3 text-sm font-semibold text-white hover:bg-[#6d4aff] transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-[#6d4aff]/25"
                >
                  Get started free
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>

              <div className="rounded-2xl bg-[#13111f] p-7 sm:p-9 text-white border border-white/[0.06] shadow-2xl shadow-black/30">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-6">How it works</div>
                <div className="space-y-5">
                  {[
                    { step: "01", title: "Choose your address", desc: `Pick a unique @${domain} username` },
                    { step: "02", title: "Verify you're human", desc: "Quick CAPTCHA to prevent abuse" },
                    { step: "03", title: "Set a strong password", desc: "Hashed securely — we never see it" },
                    { step: "04", title: "Save your recovery key", desc: "Your only backup — keep it safe" },
                  ].map(({ step, title, desc }, i, arr) => (
                    <div key={step} className="flex gap-4 relative">
                      {i < arr.length - 1 && (
                        <div className="absolute left-4 top-8 bottom-0 w-px bg-gradient-to-b from-[#6d4aff]/40 to-transparent" />
                      )}
                      <div className="w-8 h-8 rounded-full bg-[#6d4aff]/20 border border-[#6d4aff]/30 text-[#a78bfa] flex items-center justify-center text-[11px] font-bold shrink-0">
                        {step}
                      </div>
                      <div className="pb-1">
                        <div className="text-sm font-semibold text-white/90">{title}</div>
                        <div className="text-xs text-white/40 mt-0.5">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="px-6 py-20 sm:py-24 bg-white">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-12 sm:mb-16">
              <div className="inline-flex items-center gap-2 text-[10px] font-bold text-[#6d4aff] uppercase tracking-[0.22em] mb-3">
                <span className="w-5 h-px bg-[#6d4aff]" />
                Pricing
                <span className="w-5 h-px bg-[#6d4aff]" />
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1c1b33] tracking-tight">
                Simple, transparent pricing
              </h2>
              <p className="mt-3 text-[#65637e] text-sm sm:text-base">No hidden fees. No ads. Upgrade or downgrade anytime.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl p-6 sm:p-8 flex flex-col transition-all duration-300 ${
                    plan.filled
                      ? "bg-gradient-to-b from-[#7c5cfc] to-[#6d4aff] text-white shadow-2xl shadow-[#6d4aff]/35 scale-[1.02]"
                      : "bg-white border border-[#e8e4f8] shadow-sm hover:shadow-md hover:border-[#c4b5fd]"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#f0c34b] text-[#1c1b33] text-[11px] font-bold px-4 py-1 whitespace-nowrap shadow-md shadow-amber-400/30">
                      {plan.badge}
                    </div>
                  )}
                  <div>
                    <div className={`text-[11px] font-bold uppercase tracking-[0.18em] ${plan.filled ? "text-white/60" : "text-[#6d4aff]"}`}>
                      {plan.name}
                    </div>
                    <div className="flex items-end gap-1.5 mt-3">
                      <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
                      <span className={`text-sm pb-1.5 ${plan.filled ? "text-white/50" : "text-[#9896b4]"}`}>/ {plan.period}</span>
                    </div>
                    <p className={`mt-2 text-[13px] ${plan.filled ? "text-white/65" : "text-[#65637e]"}`}>{plan.desc}</p>
                  </div>
                  <div className={`mt-5 mb-6 border-t ${plan.filled ? "border-white/10" : "border-[#f0edfb]"}`} />
                  <ul className="space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-[13px]">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${plan.filled ? "bg-white/15" : "bg-[#f3f0fd]"}`}>
                          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`w-2.5 h-2.5 ${plan.filled ? "text-white" : "text-[#6d4aff]"}`}>
                            <polyline points="2 6 5 9 10 3" />
                          </svg>
                        </div>
                        <span className={plan.filled ? "text-white/90" : "text-[#1c1b33]"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.ctaHref}
                    className={`mt-8 block text-center rounded-full py-3 text-sm font-semibold transition-all duration-200 ${
                      plan.filled
                        ? "bg-white text-[#6d4aff] hover:bg-[#f3f0fd] shadow-md"
                        : "bg-[#6d4aff] text-white hover:bg-[#5b3dff] shadow-md shadow-[#6d4aff]/25 hover:shadow-lg hover:shadow-[#6d4aff]/35"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-[12px] text-[#9896b4]">
              All plans include a 30-day money-back guarantee. No questions asked.
            </p>
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="relative px-6 py-24 sm:py-32 bg-[#0e0c22] overflow-hidden">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-[700px] h-[400px] rounded-full bg-[#6d4aff]/15 blur-[130px]" />
          </div>
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.035]"
            style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#6d4aff]/30 bg-[#6d4aff]/10 px-4 py-1.5 text-[10px] font-bold text-[#a78bfa] tracking-[0.2em] uppercase mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa] animate-pulse" />
              Get started today
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.1]">
              Start protecting your<br />
              <span className="bg-gradient-to-r from-[#a78bfa] via-[#818cf8] to-[#6d4aff] bg-clip-text text-transparent">
                privacy today
              </span>
            </h2>
            <p className="mt-5 text-white/50 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
              Free forever. No credit card. No phone number. Just your @{domain} address.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2.5 rounded-full bg-[#6d4aff] px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-[#6d4aff]/40 hover:bg-[#7d5fff] hover:shadow-2xl hover:shadow-[#6d4aff]/50 transition-all duration-200"
              >
                Create your free account
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-5 sm:gap-8">
              {["Free forever", "No credit card", "Cancel anytime"].map((item) => (
                <div key={item} className="flex items-center gap-1.5 text-[12px] text-white/35">
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-[#6d4aff]">
                    <polyline points="2 6 5 9 10 3" />
                  </svg>
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-6 text-white/25 text-[13px]">
              Already have an account?{" "}
              <Link href="/login" className="text-white/50 hover:text-white underline underline-offset-2 transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-[#080710] border-t border-white/[0.05]">
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-10 grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">

          {/* Brand */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-1 flex flex-col gap-5">
            <div className="flex items-center gap-2.5">
              <img src="/sendora-logo.png" alt="Sendora" className="w-8 h-8 object-contain" />
              <span className="text-base font-semibold text-white tracking-tight">Sendora</span>
            </div>
            <p className="text-[13px] text-white/40 leading-relaxed max-w-[210px]">
              Modern email experience, reimagined for privacy and speed.
            </p>
            <a href="mailto:support@sendora.me" className="inline-flex items-center gap-2 text-[13px] text-[#7c6aff] hover:text-[#a78bff] transition-colors group w-fit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                <rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 10 7 10-7"/>
              </svg>
              support@sendora.me
            </a>
          </div>

          {/* Product */}
          <div className="flex flex-col gap-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Product</p>
            <nav className="flex flex-col gap-3">
              {[
                { label: "Features", href: "#features" },
                { label: "Pricing", href: "#pricing" },
                { label: "Temporary Inbox", href: "/temp-inbox" },
                { label: "Business Email", href: "/signup" },
              ].map(({ label, href }) => (
                <a key={label} href={href} className="text-[13px] text-white/45 hover:text-white/85 transition-colors w-fit">{label}</a>
              ))}
            </nav>
          </div>

          {/* Company */}
          <div className="flex flex-col gap-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Company</p>
            <nav className="flex flex-col gap-3">
              {[
                { label: "About", href: "/about" },
                { label: "Contact", href: "/contact" },
                { label: "Privacy Policy", href: "/privacy-policy" },
                { label: "Terms & Conditions", href: "/terms" },
                { label: "Security", href: "/security" },
              ].map(({ label, href }) => (
                <a key={label} href={href} className="text-[13px] text-white/45 hover:text-white/85 transition-colors w-fit">{label}</a>
              ))}
            </nav>
          </div>

          {/* Resources */}
          <div className="flex flex-col gap-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Resources</p>
            <nav className="flex flex-col gap-3">
              {[
                { label: "Help Center", href: "/help", badge: "" },
                { label: "Blog", href: "#", badge: "Soon" },
                { label: "Status", href: "#", badge: "Soon" },
              ].map(({ label, href, badge }) => (
                <a key={label} href={href} className="inline-flex items-center gap-2 text-[13px] text-white/45 hover:text-white/85 transition-colors w-fit">
                  {label}
                  {badge && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/35 border border-white/[0.07] leading-none tracking-wide">
                      {badge}
                    </span>
                  )}
                </a>
              ))}
            </nav>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6">
          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
        </div>

        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left">
            <p className="text-[12px] text-white/25">© {new Date().getFullYear()} Sendora. All rights reserved.</p>
            <span className="hidden sm:inline text-white/10">·</span>
            <p className="text-[12px] text-white/18">Built in India. Designed for the World.</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" aria-label="Sendora on X" className="text-white/25 hover:text-white/65 transition-colors duration-200">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.254 5.622 5.91-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a href="#" aria-label="Sendora on LinkedIn" className="text-white/25 hover:text-white/65 transition-colors duration-200">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
