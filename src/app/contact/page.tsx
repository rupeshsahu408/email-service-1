import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact Us — Sendora",
  description:
    "Get in touch with the Sendora team. Reach our founders, visit our New Delhi headquarters, or send us a message. We're here to help with any inquiry.",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 mb-2 px-3 py-1.5 rounded-full bg-[#6d4aff]/10 border border-[#6d4aff]/20">
      <span className="text-[10px] font-bold text-[#a78bff] uppercase tracking-[0.18em]">{children}</span>
    </div>
  );
}

function InfoRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const content = (
    <div className="flex items-start gap-4">
      <div className="shrink-0 w-10 h-10 rounded-xl bg-[#6d4aff]/12 text-[#a78bff] flex items-center justify-center mt-0.5">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-semibold text-white/25 uppercase tracking-[0.15em] mb-1">{label}</p>
        <p className="text-[14px] font-medium text-white/80">{value}</p>
      </div>
    </div>
  );
  if (href) {
    return (
      <a href={href} className="block hover:opacity-80 transition-opacity">
        {content}
      </a>
    );
  }
  return <div>{content}</div>;
}

export default function ContactPage() {
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
              <path d="M2 3a1 1 0 0 0-1 1v1.586l8.707 8.707a1 1 0 0 0 1.414 0L19 6.586V4a1 1 0 0 0-1-1H2Zm17 5.414-7.293 7.293a3 3 0 0 1-4.244 0L1 8.414V16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8.414Z" />
            </svg>
            <span className="text-[11px] font-semibold text-[#a78bff] uppercase tracking-wider">Contact Sendora</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.08]">
            Get in Touch.<br />
            <span className="bg-gradient-to-r from-[#a78bff] via-[#7c6aff] to-[#6d4aff] bg-clip-text text-transparent">
              We're Listening.
            </span>
          </h1>
          <p className="text-[16px] sm:text-[17px] text-white/50 max-w-2xl mx-auto leading-relaxed">
            Whether you have a question about our platform, a partnership inquiry, a support request, or simply wish to
            reach our founding team — Sendora is committed to responding with the same rigour and care that defines
            every aspect of our service.
          </p>
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
            {[
              { value: "< 24h", label: "Average Response Time" },
              { value: "2", label: "Founding Members" },
              { value: "New Delhi", label: "Headquarters" },
              { value: "Global", label: "Support Coverage" },
            ].map(({ value, label }) => (
              <div key={label} className="bg-[#0d0b1e]/60 px-6 py-8 flex flex-col items-center gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{value}</span>
                <span className="text-[12px] text-white/35 font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Leadership & Founders ── */}
      <section className="border-t border-white/[0.05]" id="founders">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Our Founders</SectionLabel>
          <div className="mt-4 mb-12 max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug mb-5">
              Meet the visionaries behind Sendora's mission for a more private digital world.
            </h2>
            <p className="text-[15px] text-white/50 leading-relaxed">
              Sendora was conceived, designed, and brought to life by two deeply committed individuals — one rooted in the
              technological heartland of India, and one in the United States — who share an uncompromising belief that
              the future of digital communication must be built on transparency, security, and user sovereignty.
            </p>
          </div>

          {/* Founder 1 — Rupesh Sahu */}
          <div className="mb-16">
            <div className="grid lg:grid-cols-[320px_1fr] gap-10 items-start">
              <div className="flex flex-col gap-0 rounded-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-b from-[#110e28] to-[#0d0b1e]">
                <div className="h-64 bg-gradient-to-br from-[#1a1440] via-[#6d4aff]/20 to-[#0d0b1e] flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(109,74,255,0.25),transparent_70%)]" />
                  <div className="relative flex flex-col items-center gap-3">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#6d4aff] to-[#a78bff] flex items-center justify-center shadow-2xl shadow-[#6d4aff]/40">
                      <span className="text-4xl font-extrabold text-white tracking-tight select-none">R</span>
                    </div>
                    <p className="text-[10px] font-semibold text-[#a78bff]/70 uppercase tracking-[0.18em]">Founder & CEO</p>
                  </div>
                </div>
                <div className="px-7 py-6 flex flex-col gap-4">
                  <div>
                    <h3 className="text-[20px] font-extrabold text-white tracking-tight">Rupesh Sahu</h3>
                    <p className="text-[13px] text-[#a78bff] font-medium mt-0.5">Founder & Chief Executive Officer</p>
                  </div>
                  <div className="h-px bg-white/[0.06]" />
                  <div className="flex flex-col gap-2.5 text-[12.5px]">
                    <div className="flex items-center gap-2.5 text-white/40">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[#6d4aff]/60 shrink-0">
                        <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 15.65 17 13.102 17 10a7 7 0 1 0-14 0c0 3.102 1.698 5.65 3.354 7.385a13.31 13.31 0 0 0 2.273 1.765 11.842 11.842 0 0 0 1.038.573l.018.008.006.003ZM10 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd" />
                      </svg>
                      New Delhi, India
                    </div>
                    <div className="flex items-center gap-2.5 text-white/40">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[#6d4aff]/60 shrink-0">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0 0 16 4H4a2 2 0 0 0-1.997 1.884Z" />
                        <path d="m18 8.118-8 4-8-4V14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.118Z" />
                      </svg>
                      rupesh@sendora.me
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 mt-1">
                    {[
                      { label: "Role", value: "Founder & CEO" },
                      { label: "Domain", value: "Full-Stack & Security" },
                      { label: "Based In", value: "India" },
                    ].map(({ label, value }) => (
                      <div key={label} className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex justify-between items-center">
                        <p className="text-[11px] font-semibold text-white/25 uppercase tracking-[0.12em]">{label}</p>
                        <p className="text-[12px] font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug">
                  Rupesh Sahu — Founder & Chief Executive Officer
                </h2>
                <div className="flex flex-col gap-5 text-[15px] text-white/55 leading-[1.82]">
                  <p>
                    Rupesh Sahu is the Founder and Chief Executive Officer of Sendora, and the principal architect of
                    its foundational technology platform. A self-directed and deeply motivated technologist with an
                    abiding commitment to digital privacy and user sovereignty, Rupesh conceived of Sendora not merely
                    as a commercial product, but as a philosophical and architectural declaration: that individuals
                    in the modern digital age possess an inalienable right to communication infrastructure that treats
                    them as autonomous, sovereign beings rather than as data commodities to be surveilled, profiled,
                    and monetised.
                  </p>
                  <p>
                    Rupesh's entry into the domain of software engineering was shaped by an acute and early awareness
                    of the structural asymmetries inherent in advertising-funded technology services. He recognised,
                    with considerable prescience, that within the prevailing ecosystem of ostensibly "free" digital
                    tools, the user does not consume a product — the user, in the truest commercial sense, becomes
                    the product itself. This foundational insight crystallised into the singular governing principle
                    of Sendora: a platform whose business model is not merely compatible with user interests, but
                    intrinsically and contractually aligned with them.
                  </p>
                  <p>
                    Technically, Rupesh brings exceptional breadth and rigorous depth to his role as principal
                    architect and chief executive. His expertise spans the full breadth of modern web engineering —
                    encompassing full-stack application development (Next.js, TypeScript, React), relational database
                    architecture and query optimisation (PostgreSQL, Drizzle ORM), distributed caching and
                    rate-limiting systems (Redis, Upstash), cryptographic security engineering (Argon2id, WebAuthn
                    /FIDO2, passkey authentication), artificial intelligence integration (Google Gemini), cloud
                    infrastructure management (Cloudflare, Vercel), and payment systems implementation (Razorpay).
                    The Sendora platform — from its hardened authentication layer to its AI-powered composition and
                    summarisation features — is a direct and unmediated expression of his engineering philosophy
                    and his refusal to accept mediocrity at any level of the technical stack.
                  </p>
                  <p>
                    As a leader, Rupesh combines the instincts of a visionary product architect with the precision
                    and intellectual discipline of a rigorous systems engineer. He approaches every design decision —
                    from the micro-level user interaction within the composition interface to the macro-level
                    architecture of the email routing and delivery pipeline — with the same non-negotiable governing
                    question: does this feature, at this layer of implementation, genuinely serve the user's interest,
                    without compromise or concealment?
                  </p>
                  <p>
                    His vision for Sendora extends well beyond its present capabilities. He envisions a future in
                    which Sendora occupies the position of the world's definitive platform for private, intelligent,
                    and trustworthy digital communication — the email service of first choice for discerning
                    individuals, professionals, enterprises, and institutions who understand, unequivocally, that the
                    privacy of their correspondence is not a commercial luxury to be purchased at a premium, but a
                    fundamental and inviolable right. Rupesh is constructing that future, with painstaking precision
                    and unwavering purpose — from New Delhi, India, for the world.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-16" />

          {/* Founder 2 — Rana Nara Sterling */}
          <div>
            <div className="grid lg:grid-cols-[1fr_320px] gap-10 items-start">
              <div className="flex flex-col gap-6 lg:order-1 order-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug">
                  Rana Nara Sterling — Co-Founder & Chief Strategy Officer
                </h2>
                <div className="flex flex-col gap-5 text-[15px] text-white/55 leading-[1.82]">
                  <p>
                    Rana Nara Sterling is the Co-Founder and Chief Strategy Officer of Sendora, serving as the
                    principal architect of the company's commercial strategy, international growth trajectory,
                    and product vision as it pertains to the global market. Based in the United States, Rana
                    brings to the founding partnership a perspective that is simultaneously commercially astute,
                    globally oriented, and deeply invested in the proposition that trustworthy digital
                    communication infrastructure represents one of the most consequential opportunities of the
                    present technological era.
                  </p>
                  <p>
                    Rana's strategic acumen is grounded in a sophisticated understanding of the global technology
                    landscape — the competitive dynamics, the regulatory environment, the evolving expectations
                    of privacy-conscious consumers, and the growing institutional demand for communication
                    platforms that can be trusted at an enterprise level. She brings to Sendora a comprehensive
                    strategic framework that encompasses market positioning, partnership development, regulatory
                    compliance strategy across multiple jurisdictions, and the articulation of Sendora's value
                    proposition to audiences ranging from individual privacy advocates to large-scale
                    organisational buyers.
                  </p>
                  <p>
                    As Co-Founder, Rana has been an essential and equal partner in shaping the foundational
                    values, the commercial architecture, and the long-term strategic direction of Sendora
                    from its earliest formative stages. She operates as the bridge between Sendora's
                    technological excellence and its broader market and societal impact — ensuring that the
                    platform's capabilities are communicated with clarity, positioned with precision, and
                    delivered with the standard of professionalism that the enterprise market demands.
                  </p>
                  <p>
                    Rana is a forceful and articulate advocate for the principle that privacy in digital
                    communication is not a niche preference but a mainstream and increasingly urgent requirement
                    across both consumer and enterprise markets. Her role within Sendora encompasses oversight
                    of all strategic partnerships, international market entry planning, brand governance, and
                    the formulation of Sendora's public policy positions with respect to data protection,
                    digital rights, and the regulatory obligations of a responsible email service provider.
                  </p>
                  <p>
                    Her presence within the founding leadership of Sendora ensures that the platform's technical
                    brilliance is matched by equally sophisticated strategic thinking — and that Sendora's
                    global ambitions are pursued with the discipline, the cultural intelligence, and the
                    commercial rigour that international expansion at scale demands. Rana represents Sendora's
                    commitment to building not merely a product, but a durable and globally respected institution
                    in the field of private digital communication — built with integrity, from the United States,
                    for the world.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-0 rounded-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-b from-[#110e28] to-[#0d0b1e] lg:order-2 order-1">
                <div className="h-64 bg-gradient-to-br from-[#1a1440] via-[#6d4aff]/20 to-[#0d0b1e] flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(109,74,255,0.25),transparent_70%)]" />
                  <div className="relative flex flex-col items-center gap-3">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#a78bff] to-[#6d4aff] flex items-center justify-center shadow-2xl shadow-[#a78bff]/40">
                      <span className="text-4xl font-extrabold text-white tracking-tight select-none">R</span>
                    </div>
                    <p className="text-[10px] font-semibold text-[#a78bff]/70 uppercase tracking-[0.18em]">Co-Founder & CSO</p>
                  </div>
                </div>
                <div className="px-7 py-6 flex flex-col gap-4">
                  <div>
                    <h3 className="text-[20px] font-extrabold text-white tracking-tight">Rana Nara Sterling</h3>
                    <p className="text-[13px] text-[#a78bff] font-medium mt-0.5">Co-Founder & Chief Strategy Officer</p>
                  </div>
                  <div className="h-px bg-white/[0.06]" />
                  <div className="flex flex-col gap-2.5 text-[12.5px]">
                    <div className="flex items-center gap-2.5 text-white/40">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[#6d4aff]/60 shrink-0">
                        <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 15.65 17 13.102 17 10a7 7 0 1 0-14 0c0 3.102 1.698 5.65 3.354 7.385a13.31 13.31 0 0 0 2.273 1.765 11.842 11.842 0 0 0 1.038.573l.018.008.006.003ZM10 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd" />
                      </svg>
                      United States of America
                    </div>
                    <div className="flex items-center gap-2.5 text-white/40">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[#6d4aff]/60 shrink-0">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0 0 16 4H4a2 2 0 0 0-1.997 1.884Z" />
                        <path d="m18 8.118-8 4-8-4V14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.118Z" />
                      </svg>
                      rana@sendora.me
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 mt-1">
                    {[
                      { label: "Role", value: "Co-Founder & CSO" },
                      { label: "Domain", value: "Strategy & Growth" },
                      { label: "Based In", value: "USA" },
                    ].map(({ label, value }) => (
                      <div key={label} className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex justify-between items-center">
                        <p className="text-[11px] font-semibold text-white/25 uppercase tracking-[0.12em]">{label}</p>
                        <p className="text-[12px] font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact Information ── */}
      <section className="border-t border-white/[0.05] bg-gradient-to-b from-[#0c0a1e]/60 to-transparent" id="contact-info">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Contact Information</SectionLabel>
          <div className="mt-4 mb-12 max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug mb-5">
              Reach Sendora — our team is available across multiple channels.
            </h2>
            <p className="text-[15px] text-white/50 leading-relaxed">
              All official communications directed to Sendora are treated with the highest degree of confidentiality
              and professionalism. Our support and executive teams are committed to responding to all substantive
              enquiries within one business day, subject to volume and complexity.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-12">
            {/* Office */}
            <div className="p-7 rounded-2xl bg-white/[0.025] border border-white/[0.07] hover:border-[#6d4aff]/25 transition-colors flex flex-col gap-6">
              <div className="w-12 h-12 rounded-2xl bg-[#6d4aff]/12 text-[#a78bff] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 mb-2">Registered Office</p>
                <p className="text-[15px] font-semibold text-white mb-2">Sendora Headquarters</p>
                <p className="text-[13.5px] text-white/50 leading-relaxed">
                  New Delhi, India<br />
                  National Capital Territory<br />
                  110001
                </p>
              </div>
              <div className="mt-auto pt-3 border-t border-white/[0.06]">
                <p className="text-[11px] text-white/25 leading-relaxed">Primary operational hub for all India-based development, infrastructure oversight, and executive functions.</p>
              </div>
            </div>

            {/* Email */}
            <div className="p-7 rounded-2xl bg-white/[0.025] border border-white/[0.07] hover:border-[#6d4aff]/25 transition-colors flex flex-col gap-6">
              <div className="w-12 h-12 rounded-2xl bg-[#6d4aff]/12 text-[#a78bff] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                  <rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 10 7 10-7"/>
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 mb-2">Electronic Mail</p>
                <p className="text-[15px] font-semibold text-white mb-2">Support & Enquiries</p>
                <a href="mailto:support@sendora.me" className="text-[14px] text-[#a78bff] hover:text-[#c4b0ff] transition-colors font-medium">
                  support@sendora.me
                </a>
                <p className="text-[13.5px] text-white/50 leading-relaxed mt-2">
                  General support, billing questions, account access, technical issues, and all user-facing enquiries.
                </p>
              </div>
              <div className="mt-auto pt-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
                  <p className="text-[11px] text-white/25">Typically responded to within 24 hours</p>
                </div>
              </div>
            </div>

            {/* Phone / Future */}
            <div className="p-7 rounded-2xl bg-white/[0.025] border border-white/[0.07] hover:border-[#6d4aff]/25 transition-colors flex flex-col gap-6">
              <div className="w-12 h-12 rounded-2xl bg-[#6d4aff]/12 text-[#a78bff] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.37 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 mb-2">Phone Support</p>
                <p className="text-[15px] font-semibold text-white mb-2">Dedicated Line</p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                  <span className="text-[11px] font-semibold text-white/30 tracking-wide">Coming Soon</span>
                </div>
                <p className="text-[13.5px] text-white/50 leading-relaxed mt-3">
                  A dedicated telephone support line for enterprise and business subscribers is currently being established and will be announced shortly.
                </p>
              </div>
              <div className="mt-auto pt-3 border-t border-white/[0.06]">
                <p className="text-[11px] text-white/25 leading-relaxed">Enterprise clients may request priority contact arrangements via email.</p>
              </div>
            </div>
          </div>

          {/* Additional channels */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "General Enquiries",
                value: "support@sendora.me",
                href: "mailto:support@sendora.me",
                desc: "All general platform and account questions",
              },
              {
                label: "Business & Partnerships",
                value: "support@sendora.me",
                href: "mailto:support@sendora.me",
                desc: "Partnership proposals and B2B enquiries",
              },
              {
                label: "Security Disclosures",
                value: "support@sendora.me",
                href: "mailto:support@sendora.me",
                desc: "Responsible disclosure of security vulnerabilities",
              },
              {
                label: "Legal & Compliance",
                value: "support@sendora.me",
                href: "mailto:support@sendora.me",
                desc: "Legal notices, GDPR requests, compliance matters",
              },
            ].map(({ label, value, href, desc }) => (
              <a key={label} href={href} className="block p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-[#6d4aff]/25 hover:bg-white/[0.035] transition-all group">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25 mb-2">{label}</p>
                <p className="text-[13px] font-semibold text-[#a78bff] group-hover:text-[#c4b0ff] transition-colors mb-1.5">{value}</p>
                <p className="text-[12px] text-white/35 leading-relaxed">{desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact Form ── */}
      <section className="border-t border-white/[0.05]" id="contact-form">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-start">

            {/* Left — context */}
            <div>
              <SectionLabel>Send a Message</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug mt-4 mb-6">
                Compose your enquiry — we'll respond with full attention and care.
              </h2>
              <p className="text-[15px] text-white/50 leading-relaxed mb-8">
                Please use the form alongside to submit your enquiry to the Sendora team. All submissions are
                reviewed by our support and executive staff. We endeavour to respond to all messages within
                one business day. For urgent matters, please mark your subject accordingly.
              </p>

              <div className="flex flex-col gap-5">
                {[
                  {
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4.5 h-4.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                      </svg>
                    ),
                    title: "Confidential & Secure",
                    body: "All communications are transmitted over encrypted connections and handled with strict confidentiality by authorised personnel only.",
                  },
                  {
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4.5 h-4.5">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                    ),
                    title: "Prompt Response",
                    body: "Our team is committed to reviewing and responding to every substantive enquiry within 24 hours during standard business operations.",
                  },
                  {
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4.5 h-4.5">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                    ),
                    title: "Reviewed by Leadership",
                    body: "Significant enquiries — including partnership proposals, media requests, and enterprise discussions — are escalated directly to our founding leadership.",
                  },
                ].map(({ icon, title, body }) => (
                  <div key={title} className="flex gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="shrink-0 w-9 h-9 rounded-xl bg-[#6d4aff]/12 text-[#a78bff] flex items-center justify-center">
                      {icon}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-[13.5px] mb-1">{title}</p>
                      <p className="text-[12.5px] text-white/42 leading-relaxed">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — form */}
            <div className="rounded-3xl bg-white/[0.025] border border-white/[0.08] p-8 sm:p-10">
              <form
                action={`mailto:support@sendora.me`}
                method="get"
                encType="text/plain"
                className="flex flex-col gap-6"
              >
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-semibold text-white/35 uppercase tracking-[0.15em]">
                      First Name <span className="text-[#6d4aff]">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      required
                      placeholder="Your first name"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.09] text-white text-[14px] placeholder:text-white/20 focus:outline-none focus:border-[#6d4aff]/50 focus:bg-white/[0.07] transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-semibold text-white/35 uppercase tracking-[0.15em]">
                      Last Name <span className="text-[#6d4aff]">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      required
                      placeholder="Your last name"
                      className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.09] text-white text-[14px] placeholder:text-white/20 focus:outline-none focus:border-[#6d4aff]/50 focus:bg-white/[0.07] transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-semibold text-white/35 uppercase tracking-[0.15em]">
                    Email Address <span className="text-[#6d4aff]">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.09] text-white text-[14px] placeholder:text-white/20 focus:outline-none focus:border-[#6d4aff]/50 focus:bg-white/[0.07] transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-semibold text-white/35 uppercase tracking-[0.15em]">
                    Organisation / Company
                  </label>
                  <input
                    type="text"
                    name="organisation"
                    placeholder="Your company or organisation (optional)"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.09] text-white text-[14px] placeholder:text-white/20 focus:outline-none focus:border-[#6d4aff]/50 focus:bg-white/[0.07] transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-semibold text-white/35 uppercase tracking-[0.15em]">
                    Subject / Nature of Enquiry <span className="text-[#6d4aff]">*</span>
                  </label>
                  <select
                    name="subject"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.09] text-white text-[14px] focus:outline-none focus:border-[#6d4aff]/50 focus:bg-white/[0.07] transition-all appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}
                  >
                    <option value="" className="bg-[#0d0b1e]">Select an enquiry type</option>
                    <option value="General Support" className="bg-[#0d0b1e]">General Support</option>
                    <option value="Account & Billing" className="bg-[#0d0b1e]">Account & Billing</option>
                    <option value="Business & Enterprise" className="bg-[#0d0b1e]">Business & Enterprise</option>
                    <option value="Partnership Proposal" className="bg-[#0d0b1e]">Partnership Proposal</option>
                    <option value="Media & Press" className="bg-[#0d0b1e]">Media & Press</option>
                    <option value="Security Disclosure" className="bg-[#0d0b1e]">Security Disclosure</option>
                    <option value="Legal & Compliance" className="bg-[#0d0b1e]">Legal & Compliance</option>
                    <option value="Other" className="bg-[#0d0b1e]">Other</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-semibold text-white/35 uppercase tracking-[0.15em]">
                    Message <span className="text-[#6d4aff]">*</span>
                  </label>
                  <textarea
                    name="body"
                    required
                    rows={6}
                    placeholder="Please describe your enquiry in as much detail as possible. For support issues, include your registered email address and a description of the issue encountered."
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.09] text-white text-[14px] placeholder:text-white/20 focus:outline-none focus:border-[#6d4aff]/50 focus:bg-white/[0.07] transition-all resize-none leading-relaxed"
                  />
                </div>

                <div className="p-4 rounded-xl bg-[#6d4aff]/08 border border-[#6d4aff]/15 flex gap-3">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#a78bff] shrink-0 mt-0.5">
                    <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
                  </svg>
                  <p className="text-[12px] text-white/40 leading-relaxed">
                    By submitting this form, your message will be directed to <span className="text-[#a78bff]">support@sendora.me</span> via your default mail client. All information submitted is handled in accordance with our Privacy Policy.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#6d4aff] to-[#8b6aff] text-white font-semibold text-[14.5px] tracking-tight hover:from-[#7d5aff] hover:to-[#9b7aff] transition-all shadow-lg shadow-[#6d4aff]/25 focus:outline-none focus:ring-2 focus:ring-[#6d4aff]/50"
                >
                  Submit Enquiry →
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── Compliance & Legal note ── */}
      <section className="border-t border-white/[0.05] bg-gradient-to-b from-[#0c0a1e]/40 to-transparent">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                number: "01",
                title: "Data Privacy Commitment",
                body: "All personal information submitted via this contact page is processed exclusively for the purpose of responding to your enquiry and is handled in strict accordance with applicable data protection legislation, including the provisions of the Information Technology Act, 2000 (India) and international equivalents.",
              },
              {
                number: "02",
                title: "Response Standards",
                body: "Sendora commits to acknowledging all enquiries received via official channels within one business day. Complex technical, legal, or commercial matters may require additional review time, in which case an interim acknowledgement will be dispatched upon receipt.",
              },
              {
                number: "03",
                title: "Official Channels Only",
                body: "For the avoidance of doubt, Sendora's only officially recognised support and contact channel is support@sendora.me. Any communication purporting to originate from Sendora from a different domain should be treated with caution and reported immediately.",
              },
            ].map(({ number, title, body }) => (
              <div key={number} className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col gap-4">
                <span className="text-[11px] font-bold text-[#6d4aff]/60 tracking-[0.2em]">{number}</span>
                <h3 className="text-[15px] font-bold text-white leading-snug">{title}</h3>
                <p className="text-[13px] text-white/40 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05] mt-auto">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <img src="/sendora-logo.png" alt="Sendora" className="w-6 h-6 object-contain" />
              <span className="text-[13px] font-semibold text-white/50 tracking-tight">Sendora</span>
            </Link>
            <span className="text-white/10">·</span>
            <p className="text-[12px] text-white/25">© {new Date().getFullYear()} Sendora. All rights reserved.</p>
          </div>
          <div className="flex items-center gap-5 text-[12px] text-white/30">
            <Link href="/about" className="hover:text-white/60 transition-colors">About</Link>
            <Link href="/privacy-policy" className="hover:text-white/60 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-white/60 transition-colors text-[#a78bff]">Contact</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
