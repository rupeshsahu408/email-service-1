import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us — Sendora",
  description:
    "Learn about Sendora's mission to build the world's most private, secure, and intelligent email platform. Meet our founder and discover the infrastructure that powers sendora.me.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#080710] text-white flex flex-col">

      {/* ── Header ── */}
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/sendora-logo.png" alt="Sendora" className="w-8 h-8 object-contain" />
            <span className="text-base font-semibold text-white tracking-tight">Sendora</span>
          </Link>
          <Link href="/" className="text-[13px] text-white/45 hover:text-white/85 transition-colors">
            ← Back to home
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d0b1e] via-[#130f2e] to-[#080710]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(109,74,255,0.18),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-[#6d4aff]/15 border border-[#6d4aff]/25">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[#a78bff]">
              <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" />
            </svg>
            <span className="text-[11px] font-semibold text-[#a78bff] uppercase tracking-wider">About Sendora</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.08]">
            Built on Trust.<br />
            <span className="bg-gradient-to-r from-[#a78bff] via-[#7c6aff] to-[#6d4aff] bg-clip-text text-transparent">
              Engineered for Privacy.
            </span>
          </h1>
          <p className="text-[16px] sm:text-[17px] text-white/50 max-w-2xl mx-auto leading-relaxed">
            Sendora is a privacy-first email platform designed for individuals and businesses who believe
            that digital communication should be secure, intelligent, and completely under their control.
          </p>
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
            {[
              { value: "150+", label: "Countries Served" },
              { value: "99.9%", label: "Uptime Reliability" },
              { value: "Zero", label: "Ads. Ever." },
              { value: "256-bit", label: "Encryption Standard" },
            ].map(({ value, label }) => (
              <div key={label} className="bg-[#0d0b1e]/60 px-6 py-8 flex flex-col items-center gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{value}</span>
                <span className="text-[12px] text-white/35 font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Our Story ── */}
      <section className="border-t border-white/[0.05]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Our Story</SectionLabel>
          <div className="mt-8 grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug mb-6">
                A platform conceived from the belief that privacy is a fundamental right — not a premium feature.
              </h2>
              <div className="flex flex-col gap-5 text-[15px] text-white/55 leading-relaxed">
                <p>
                  Sendora was founded with a singular conviction: that the people who entrust their most sensitive
                  communications to an email platform deserve absolute transparency, uncompromising security, and
                  the assurance that their data will never be monetised, surveilled, or exploited.
                </p>
                <p>
                  In an era when leading email providers derive the majority of their revenue by analysing the content
                  of user inboxes to serve targeted advertisements, Sendora was built to offer a fundamentally different
                  model — one where the product is a premium service, not the user themselves.
                </p>
                <p>
                  From end-to-end cryptographic protections and passkey-based authentication to zero-tracking anonymous
                  sending and ephemeral temporary inboxes, every feature in Sendora reflects a deliberate architectural
                  decision to place control firmly in the hands of the user.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-5">
              {[
                {
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                    </svg>
                  ),
                  title: "Privacy by Design",
                  body: "Every architectural decision, from how credentials are hashed to how emails are routed, is made with user privacy as the non-negotiable starting constraint — not an afterthought.",
                },
                {
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                      <circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                    </svg>
                  ),
                  title: "Intelligence Without Surveillance",
                  body: "Sendora's AI-powered features — including smart composition, summarisation, and prioritisation — are built to enhance productivity without accessing, storing, or monetising the semantic meaning of your communications.",
                },
                {
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  ),
                  title: "Zero Compromises on Security",
                  body: "Argon2id password hashing, hardware-backed passkey authentication, encrypted session management, and end-to-end transport security form the bedrock of every Sendora account — available to all users, not just enterprise subscribers.",
                },
                {
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  ),
                  title: "Built for Everyone",
                  body: "Whether you're an individual seeking a private inbox, a professional building a brand identity through custom domains, or a business managing team communications, Sendora scales gracefully to serve your needs.",
                },
              ].map(({ icon, title, body }) => (
                <div key={title} className="flex gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-[#6d4aff]/25 transition-colors">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-[#6d4aff]/12 text-[#a78bff] flex items-center justify-center">
                    {icon}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-[14px] mb-1">{title}</p>
                    <p className="text-[13px] text-white/45 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Mission & Values ── */}
      <section className="border-t border-white/[0.05] bg-gradient-to-b from-[#0c0a1e]/60 to-transparent">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Mission & Values</SectionLabel>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                number: "01",
                title: "Radical Transparency",
                body: "We believe users have an unconditional right to understand exactly what happens to their data. Our policies are written in plain language, our practices are verifiable, and we will never engage in hidden data collection, shadow profiling, or undisclosed third-party data sharing.",
              },
              {
                number: "02",
                title: "Security Without Compromise",
                body: "Security is not a checkbox at Sendora — it is a continuous discipline. We employ defence-in-depth strategies, conduct regular security reviews, and implement protections such as hardware-backed authentication and Argon2id hashing that exceed industry norms.",
              },
              {
                number: "03",
                title: "User Sovereignty",
                body: "Your inbox is yours. You decide what is retained, what is deleted, and how your identity is presented to the world. Our Anonymous Sending and Temporary Inbox features exist specifically to extend this sovereignty into privacy-sensitive contexts.",
              },
              {
                number: "04",
                title: "Thoughtful Innovation",
                body: "We integrate AI and intelligent features deliberately, ensuring that every capability we introduce genuinely benefits the user without introducing new privacy risks. Technology at Sendora serves people — not the reverse.",
              },
              {
                number: "05",
                title: "Global Reliability",
                body: "Communication is critical infrastructure. We invest deeply in redundant systems, enterprise-grade uptime, and a delivery architecture designed to ensure your emails reach their destination reliably, regardless of geography or volume.",
              },
              {
                number: "06",
                title: "Long-Term Thinking",
                body: "Sendora is built to endure. We make decisions based on long-term user trust, not short-term engagement metrics. Our business model is aligned with your interests — we succeed when you find Sendora indispensable.",
              },
            ].map(({ number, title, body }) => (
              <div key={number} className="p-6 rounded-2xl bg-white/[0.025] border border-white/[0.06] flex flex-col gap-4 hover:border-[#6d4aff]/20 transition-colors">
                <span className="text-[11px] font-bold text-[#6d4aff]/60 tracking-[0.2em]">{number}</span>
                <h3 className="text-[16px] font-bold text-white leading-snug">{title}</h3>
                <p className="text-[13px] text-white/42 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Founder ── */}
      <section className="border-t border-white/[0.05]" id="founder">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Leadership</SectionLabel>
          <div className="mt-10 grid lg:grid-cols-[340px_1fr] gap-12 items-start">

            {/* Founder card */}
            <div className="flex flex-col gap-0 rounded-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-b from-[#110e28] to-[#0d0b1e]">
              <div className="h-72 bg-gradient-to-br from-[#1a1440] via-[#6d4aff]/20 to-[#0d0b1e] flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(109,74,255,0.25),transparent_70%)]" />
                <div className="relative flex flex-col items-center gap-3">
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#6d4aff] to-[#a78bff] flex items-center justify-center shadow-2xl shadow-[#6d4aff]/40">
                    <span className="text-5xl font-extrabold text-white tracking-tight select-none">R</span>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-semibold text-[#a78bff]/70 uppercase tracking-[0.18em]">Founder & CEO</p>
                  </div>
                </div>
              </div>
              <div className="px-7 py-6 flex flex-col gap-4">
                <div>
                  <h3 className="text-[22px] font-extrabold text-white tracking-tight">Rupesh Sahu</h3>
                  <p className="text-[13px] text-[#a78bff] font-medium mt-0.5">Founder & Chief Executive Officer</p>
                </div>
                <p className="text-[13px] text-white/42 leading-relaxed">
                  Visionary technologist and privacy advocate. Architect of the Sendora platform. Building the future of secure, private digital communication from India.
                </p>
                <div className="h-px bg-white/[0.06] my-1" />
                <div className="flex flex-col gap-2.5 text-[12.5px]">
                  <div className="flex items-center gap-2.5 text-white/40">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[#6d4aff]/60 shrink-0">
                      <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 15.65 17 13.102 17 10a7 7 0 1 0-14 0c0 3.102 1.698 5.65 3.354 7.385a13.31 13.31 0 0 0 2.273 1.765 11.842 11.842 0 0 0 1.038.573l.018.008.006.003ZM10 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd" />
                    </svg>
                    India
                  </div>
                  <div className="flex items-center gap-2.5 text-white/40">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[#6d4aff]/60 shrink-0">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0 0 16 4H4a2 2 0 0 0-1.997 1.884Z" />
                      <path d="m18 8.118-8 4-8-4V14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.118Z" />
                    </svg>
                    rupesh@sendora.me
                  </div>
                </div>
              </div>
            </div>

            {/* Founder bio */}
            <div className="flex flex-col gap-7">
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight leading-snug mb-5">
                  Rupesh Sahu — Founder & Chief Executive Officer
                </h2>
                <div className="flex flex-col gap-5 text-[15px] text-white/55 leading-[1.82]">
                  <p>
                    Rupesh Sahu is the founder and Chief Executive Officer of Sendora, and the principal architect of its
                    technology platform. A self-directed technologist with a deep and abiding commitment to digital privacy,
                    Rupesh conceived of Sendora not merely as a product, but as a philosophical statement: that individuals
                    in the digital age deserve communication infrastructure that treats them as sovereign beings rather than
                    data points to be harvested.
                  </p>
                  <p>
                    Rupesh's journey into software engineering began with an acute awareness of the structural imbalance
                    inherent in advertising-funded technology services. He recognised early that when a product is free,
                    the user invariably becomes the product — and that this transactional model is fundamentally incompatible
                    with genuine privacy. This insight crystallised into the founding principle of Sendora: a platform
                    whose commercial model is aligned with, rather than opposed to, the interests of its users.
                  </p>
                  <p>
                    Technically, Rupesh brings exceptional breadth and depth to his role. He has hands-on expertise spanning
                    full-stack web engineering (Next.js, TypeScript, React), database architecture and query optimisation
                    (PostgreSQL, Drizzle ORM), distributed systems design (Redis, Upstash), cryptographic security
                    engineering (Argon2id, WebAuthn/FIDO2, passkeys), artificial intelligence integration (Google Gemini),
                    cloud infrastructure management (Cloudflare, Vercel), and payment systems implementation (Razorpay).
                    The Sendora platform, from its authentication layer to its AI-powered composition features, reflects
                    his commitment to engineering excellence at every layer of the stack.
                  </p>
                  <p>
                    Rupesh is a strong believer in privacy-preserving system design — a discipline that requires not only
                    technical competence but the rare quality of intellectual honesty: the willingness to reject expedient
                    architectural shortcuts when they would compromise user trust. Under his leadership, Sendora has
                    implemented protections such as anonymised email sending with cryptographic alias routing, ephemeral
                    temporary inboxes with deterministic data expiry, hardware-backed passkey authentication, and
                    Zero-knowledge-friendly session management — features that rival, and in many respects exceed, the
                    privacy posture of established players in the market.
                  </p>
                  <p>
                    As a leader, Rupesh combines a product visionary's instinct for user experience with an engineer's
                    rigour for correctness and security. He approaches every design decision — from the micro-level
                    interaction in the compose window to the macro-level architecture of the email routing pipeline —
                    with the same fundamental question: does this serve the user's genuine interests, without compromise?
                  </p>
                  <p>
                    His vision for Sendora extends far beyond its current capabilities. He envisions a future in which
                    Sendora becomes the definitive platform for private, intelligent digital communication globally —
                    the email service of choice for individuals, professionals, and organisations who understand that
                    the privacy of their correspondence is not a luxury but a right. Rupesh is building that future,
                    one carefully considered line of code at a time — from India, for the world.
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: "Role", value: "Founder & CEO" },
                  { label: "Expertise", value: "Full-Stack & Security Engineering" },
                  { label: "Based in", value: "India" },
                ].map(({ label, value }) => (
                  <div key={label} className="px-5 py-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-[11px] font-semibold text-white/25 uppercase tracking-[0.15em] mb-1">{label}</p>
                    <p className="text-[13.5px] font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Infrastructure & Data Centres ── */}
      <section className="border-t border-white/[0.05] bg-gradient-to-b from-[#0c0a1e]/40 to-transparent" id="infrastructure">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Infrastructure</SectionLabel>
          <div className="mt-6 mb-14 max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug mb-5">
              Enterprise-grade infrastructure engineered for resilience, speed, and absolute security.
            </h2>
            <p className="text-[15px] text-white/50 leading-relaxed">
              Every email you send or receive through Sendora passes through a multi-layered infrastructure
              designed to be simultaneously fast, private, and fault-tolerant. Our data handling architecture
              is built on the principle that your communications are yours alone.
            </p>
          </div>

          {/* Data center image 1 — Real / India */}
          <div className="rounded-3xl overflow-hidden border border-white/[0.08] mb-8">
            <div className="relative">
              <img
                src="/about/datacenter-india.png"
                alt="Sendora India data center infrastructure"
                className="w-full h-[360px] sm:h-[440px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080710]/90 via-[#080710]/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="inline-flex items-center gap-2 mb-3 px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[11px] font-semibold text-green-400 uppercase tracking-wider">Primary — India Region</span>
                </div>
                <h3 className="text-[22px] font-bold text-white tracking-tight">Sendora Primary Data Infrastructure</h3>
                <p className="text-[13px] text-white/50 mt-1 max-w-xl">
                  Co-located within enterprise-grade Tier III+ facilities across India, purpose-built for high-throughput email workloads.
                </p>
              </div>
            </div>
            <div className="bg-[#0d0b1e]/80 px-8 py-7 grid sm:grid-cols-3 gap-6">
              {[
                { label: "Facility Tier", value: "Tier III+ Certified" },
                { label: "Power Redundancy", value: "2N UPS + Generator" },
                { label: "Network Uplinks", value: "Multiple ISPs, BGP" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/25 mb-1">{label}</p>
                  <p className="text-[14px] font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Data center image 2 — Futuristic */}
          <div className="rounded-3xl overflow-hidden border border-[#6d4aff]/20 mb-14">
            <div className="relative">
              <img
                src="/about/datacenter-futuristic.png"
                alt="Sendora next-generation futuristic data center concept"
                className="w-full h-[360px] sm:h-[440px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080710]/95 via-[#080710]/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="inline-flex items-center gap-2 mb-3 px-2.5 py-1 rounded-full bg-[#6d4aff]/15 border border-[#6d4aff]/30">
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-[#a78bff]">
                    <path d="M8 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 8 1ZM14.5 8a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1 0-1h1a.5.5 0 0 1 .5.5ZM8 13a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 8 13ZM3 8a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1 0-1h1A.5.5 0 0 1 3 8ZM5.05 4.05a.5.5 0 0 1 .707 0L6.464 4.757a.5.5 0 0 1-.707.707L5.05 4.757A.5.5 0 0 1 5.05 4.05ZM10.243 10.95a.5.5 0 0 1 .707 0l.707.707a.5.5 0 0 1-.707.707l-.707-.707a.5.5 0 0 1 0-.707ZM4.05 10.95a.5.5 0 0 1 0 .707l-.707.707a.5.5 0 0 1-.707-.707l.707-.707a.5.5 0 0 1 .707 0ZM10.95 4.05a.5.5 0 0 1 0-.707l.707-.707a.5.5 0 0 1 .707.707l-.707.707a.5.5 0 0 1-.707 0ZM8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
                  </svg>
                  <span className="text-[11px] font-semibold text-[#a78bff] uppercase tracking-wider">Next-Generation Vision</span>
                </div>
                <h3 className="text-[22px] font-bold text-white tracking-tight">Sendora Gen-2 Infrastructure Concept</h3>
                <p className="text-[13px] text-white/50 mt-1 max-w-xl">
                  Our long-term vision for quantum-resilient, AI-accelerated infrastructure — the architecture that will power the next decade of private communication.
                </p>
              </div>
            </div>
            <div className="bg-[#0d0b1e]/80 px-8 py-7 grid sm:grid-cols-3 gap-6">
              {[
                { label: "Architecture", value: "Quantum-Resilient Design" },
                { label: "AI Acceleration", value: "Neural Processing Units" },
                { label: "Cooling", value: "Liquid + Phase-Change" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/25 mb-1">{label}</p>
                  <p className="text-[14px] font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Infrastructure details */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
                title: "Physical Security",
                body: "Our co-location facilities maintain multi-factor physical access controls including biometric authentication, mantrap entry systems, 24/7 on-site security personnel, and perimeter CCTV surveillance with 90-day retention.",
              },
              {
                icon: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
                title: "Encryption in Transit & at Rest",
                body: "All data transmitted to and from Sendora servers is protected by TLS 1.3 with forward secrecy. Sensitive stored data, including session tokens and credentials, is protected using cryptographic hashing that is computationally infeasible to reverse.",
              },
              {
                icon: <><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></>,
                title: "High Availability Architecture",
                body: "Sendora's infrastructure is designed for zero single points of failure. Load balancers, redundant database replicas, and distributed caching layers ensure that planned maintenance and unexpected incidents do not result in service interruption.",
              },
              {
                icon: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" /></>,
                title: "Data Isolation",
                body: "Each user's data is logically isolated at the database level. Row-level security policies and strict query scoping ensure that no user's data is ever accessible to any other user, regardless of infrastructure co-tenancy.",
              },
              {
                icon: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5" /></>,
                title: "Automated Backups",
                body: "Database snapshots are created on a continuous basis and retained according to our data retention policies. Restoration procedures are tested regularly to ensure recovery time objectives are met in the event of data loss.",
              },
              {
                icon: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.29 7 8.71 5 8.71-5M12 22V12" /></>,
                title: "DDoS Protection & CDN",
                body: "Sendora deploys Cloudflare's enterprise-grade DDoS mitigation and global content delivery network across all public endpoints, providing protection against volumetric and application-layer attacks while ensuring low-latency global access.",
              },
            ].map(({ icon, title, body }) => (
              <div key={title} className="p-5 rounded-2xl bg-white/[0.025] border border-white/[0.06]">
                <div className="w-9 h-9 rounded-xl bg-[#6d4aff]/12 text-[#a78bff] flex items-center justify-center mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4.5 h-4.5">
                    {icon}
                  </svg>
                </div>
                <h3 className="text-[14px] font-bold text-white mb-2">{title}</h3>
                <p className="text-[12.5px] text-white/40 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What We Offer ── */}
      <section className="border-t border-white/[0.05]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>What We Offer</SectionLabel>
          <div className="mt-6 mb-12 max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug mb-4">
              A complete private email ecosystem, built for the modern internet.
            </h2>
            <p className="text-[15px] text-white/50 leading-relaxed">
              Sendora provides a unified platform of interoperable privacy-preserving email services, each designed
              to address a distinct and real communication need.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              {
                badge: "Core",
                title: "Private Email Inbox",
                body: "A full-featured, ad-free private email inbox with powerful organisation tools — labels, filters, threaded conversations, starring, and search — all built on an architecture that keeps your mail accessible only to you.",
              },
              {
                badge: "Privacy",
                title: "Anonymous Email Sending",
                body: "Send emails without revealing your primary Sendora address. Each anonymous send generates a cryptographic alias that enables reply routing while protecting your identity. Designed for legitimate privacy use cases.",
              },
              {
                badge: "Temporary",
                title: "Disposable Temp Inbox",
                body: "Generate short-lived email addresses on demand for account registrations, OTP capture, and one-time communications. Aliases expire automatically, leaving no lasting data trail.",
              },
              {
                badge: "AI",
                title: "Intelligent Composition",
                body: "AI-powered writing assistance for drafting, refining, translating, and improving your emails — built with privacy guardrails to ensure your communications remain confidential throughout the AI-assisted writing process.",
              },
              {
                badge: "Business",
                title: "Custom Domain Mailboxes",
                body: "Professional email addresses on your own domain, with full SPF, DKIM, and DMARC support. Build brand identity without sacrificing the privacy and security posture of the Sendora platform.",
              },
              {
                badge: "Automation",
                title: "Smart Rules & Scheduling",
                body: "Automated email filtering and routing rules, scheduled email delivery, and reminder systems that make your inbox work intelligently on your behalf — saving time while keeping you in control.",
              },
            ].map(({ badge, title, body }) => (
              <div key={title} className="p-6 rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-[#6d4aff]/25 transition-colors">
                <span className="inline-block text-[10px] font-bold uppercase tracking-[0.18em] text-[#6d4aff] bg-[#6d4aff]/12 px-2.5 py-1 rounded-full mb-4">{badge}</span>
                <h3 className="text-[16px] font-bold text-white mb-2.5">{title}</h3>
                <p className="text-[13px] text-white/42 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Commitment to Privacy ── */}
      <section className="border-t border-white/[0.05] bg-gradient-to-b from-[#0c0a1e]/40 to-transparent">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Our Privacy Commitment</SectionLabel>
          <div className="mt-10 rounded-3xl border border-[#6d4aff]/20 bg-gradient-to-br from-[#110e28] via-[#0f0c22] to-[#0d0b1e] p-10 sm:p-14">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#6d4aff]/15 border border-[#6d4aff]/25 mb-8">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-[#a78bff]">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight mb-6">
                "We will never read your emails. We will never sell your data. We will never serve you ads."
              </h2>
              <p className="text-[15px] text-white/50 leading-relaxed mb-8">
                This is not merely a policy statement — it is an architectural commitment. Sendora is designed from the
                ground up such that reading, selling, or monetising your email content is not only prohibited by policy,
                but is structurally contrary to how we build and operate the platform. Our revenue comes from subscription
                fees paid by users who value the service — a model that aligns our incentives with yours, not against them.
              </p>
              <div className="grid sm:grid-cols-3 gap-4 text-left">
                {[
                  { title: "No Ad Profiling", body: "We do not scan or analyse your email content to build advertising profiles." },
                  { title: "No Data Brokering", body: "We do not sell, license, or share your personal data with data brokers or advertisers." },
                  { title: "No Behavioral Tracking", body: "We do not track your browsing activity, reading habits, or correspondence patterns for profit." },
                ].map(({ title, body }) => (
                  <div key={title} className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                    <div className="flex items-center gap-2 mb-2">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-400 shrink-0">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                      </svg>
                      <p className="text-[13px] font-semibold text-white">{title}</p>
                    </div>
                    <p className="text-[12px] text-white/38 leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-white/[0.05]">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-5">
            Ready to reclaim your inbox?
          </h2>
          <p className="text-[15px] text-white/45 max-w-xl mx-auto mb-10 leading-relaxed">
            Join thousands of users who have chosen Sendora as their trusted private email platform.
            Your privacy. Your communications. Your control.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-[#6d4aff] hover:bg-[#5b3de8] text-white font-semibold text-[14px] transition-colors shadow-lg shadow-[#6d4aff]/25"
            >
              Create Free Account
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
              </svg>
            </Link>
            <Link
              href="/privacy-policy"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-white/50 hover:text-white/85 font-medium text-[14px] transition-colors border border-white/[0.08] hover:border-white/[0.15]"
            >
              Read Our Privacy Policy
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05]">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-white/25">
          <p>© {new Date().getFullYear()} Sendora. All rights reserved. Built in India. Designed for the World.</p>
          <div className="flex items-center gap-5">
            <Link href="/privacy-policy" className="hover:text-white/65 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white/65 transition-colors">Terms &amp; Conditions</Link>
            <Link href="/about" className="hover:text-white/65 transition-colors text-[#a78bff]">About Us</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-1 h-4 rounded-full bg-[#6d4aff]" />
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6d4aff]">{children}</span>
    </div>
  );
}
