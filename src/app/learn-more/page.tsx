import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Protected Message — Email Security Architecture · Sendora",
  description:
    "Understand why Sendora displays the 'Protected message' indicator when emailing Sendora addresses. Learn about our layered security architecture, encryption protocols, and privacy-first infrastructure.",
};

export default function LearnMorePage() {
  return (
    <div className="min-h-screen bg-[#080710] text-white flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#080710]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <img src="/sendora-logo.png" alt="Sendora" className="w-8 h-8 object-contain" />
            <span className="text-base font-semibold text-white tracking-tight">Sendora</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-[12px] font-medium text-white/35">
            <a href="#what-is-this" className="hover:text-white/70 transition-colors">What is this?</a>
            <a href="#authentication" className="hover:text-white/70 transition-colors">Authentication</a>
            <a href="#encryption" className="hover:text-white/70 transition-colors">Encryption</a>
            <a href="#architecture" className="hover:text-white/70 transition-colors">Architecture</a>
            <a href="#compliance" className="hover:text-white/70 transition-colors">Compliance</a>
            <a href="#faq" className="hover:text-white/70 transition-colors">FAQ</a>
          </nav>
          <Link href="/" className="text-[12px] text-white/35 hover:text-white/65 transition-colors shrink-0">
            ← Back to home
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section id="what-is-this" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d0b1e] via-[#100e28] to-[#080710]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_-5%,rgba(109,74,255,0.22),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle, #6d4aff 1px, transparent 1px)", backgroundSize: "30px 30px" }}
        />
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] rounded-full bg-[#6d4aff]/08 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] rounded-full bg-[#818cf8]/06 blur-[100px] pointer-events-none" />

        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-20">

          {/* Sendora banner replica */}
          <div className="flex justify-center mb-10">
            <div className="flex items-center gap-3 rounded-xl bg-[#f8f7ff]/[0.06] border border-[#6d4aff]/25 px-5 py-3.5 backdrop-blur-sm shadow-xl shadow-[#6d4aff]/10">
              <div className="w-5 h-5 text-[#a78bff] shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                </svg>
              </div>
              <span className="text-[13px] font-semibold text-white/80">Protected message</span>
              <span className="w-px h-4 bg-white/[0.12]" />
              <span className="text-[13px] font-medium text-[#a78bff] underline underline-offset-2">Learn more</span>
              <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.15em] bg-[#6d4aff]/20 text-[#a78bfa] px-2 py-0.5 rounded-full border border-[#6d4aff]/30">You are here</span>
            </div>
          </div>

          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-[#6d4aff]/15 border border-[#6d4aff]/25">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a78bff] animate-pulse" />
              <span className="text-[11px] font-bold text-[#a78bff] uppercase tracking-wider">Email Security Documentation</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.8rem] font-extrabold tracking-[-0.02em] text-white leading-[1.07] mb-6">
              Why Sendora shows<br />
              <span className="bg-gradient-to-r from-[#a78bff] via-[#8b6aff] to-[#6d4aff] bg-clip-text text-transparent">
                &ldquo;Protected message&rdquo;
              </span>
            </h1>

            <p className="text-[15px] sm:text-[16px] text-white/50 max-w-2xl mx-auto leading-[1.8] mb-10">
              When a Sendora user sends a message to a <strong className="text-white/70">@sendora.me</strong> address, Sendora displays
              a &ldquo;Protected message&rdquo; indicator in the message header. This page explains exactly what that indicator
              means, the underlying security architecture that triggers it, and why it is a positive signal of
              a hardened, privacy-respecting mail infrastructure — not a cause for concern.
            </p>

            {/* Quick-read KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.05] rounded-2xl overflow-hidden border border-white/[0.07] text-left">
              {[
                { metric: "TLS 1.3", sub: "Transport Encryption", icon: "🔒" },
                { metric: "DKIM · SPF · DMARC", sub: "Auth Protocols Active", icon: "✅" },
                { metric: "AES-256", sub: "Data at Rest", icon: "🔐" },
                { metric: "Zero-Knowledge", sub: "Architecture Model", icon: "🛡️" },
              ].map(({ metric, sub, icon }) => (
                <div key={sub} className="bg-[#0e0c20]/80 px-5 py-6 flex flex-col gap-2 hover:bg-[#13112a]/80 transition-colors">
                  <span className="text-xl">{icon}</span>
                  <span className="text-[14px] sm:text-[15px] font-extrabold text-white tracking-tight leading-snug">{metric}</span>
                  <span className="text-[11px] text-white/30 font-medium leading-snug">{sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── What does "Protected message" mean ── */}
      <section className="border-t border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <div className="grid lg:grid-cols-5 gap-12 lg:gap-16 items-start">

            <div className="lg:col-span-3">
              <SectionLabel>Understanding the Indicator</SectionLabel>
              <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-6">
                The Sendora &ldquo;Protected message&rdquo;<br />banner — decoded
              </h2>
              <div className="space-y-5 text-[14px] text-white/52 leading-[1.85]">
                <p>
                  Sendora displays the <span className="text-white/80 font-semibold">Protected message</span> indicator in the
                  email detail header when a message is sent to a domain that Sendora identifies as operating under a strict
                  email security policy. Specifically, Sendora presents this badge when the receiving domain — in this case
                  <span className="text-[#a78bff] font-mono text-[13px] mx-1">sendora.me</span> — has published a
                  <span className="text-white/80 font-semibold mx-1">DMARC policy of p=quarantine or p=reject</span>,
                  and has verified DKIM and SPF records that attest to the authenticity of inbound and outbound messages.
                </p>
                <p>
                  The indicator is Sendora&apos;s signal to the sender that the recipient&apos;s domain maintains a hardened
                  email authentication posture. It does <em className="text-white/75 not-italic font-semibold">not</em> imply
                  that something is wrong with the message. On the contrary, it communicates that the destination server
                  enforces strict controls over who is permitted to send on behalf of that domain, and that unauthenticated
                  or spoofed messages will be rejected outright.
                </p>
                <p>
                  Sendora proactively publishes comprehensive DNS-based authentication records across all mail-enabled
                  domains on our platform. This is part of our broader commitment to a fully authenticated email
                  infrastructure — one where every message can be cryptographically traced to its legitimate origin,
                  and where forgery and phishing attempts are structurally impeded at the protocol level.
                </p>
              </div>

              <div className="mt-8 p-5 rounded-2xl bg-[#6d4aff]/08 border border-[#6d4aff]/18 flex gap-4">
                <div className="w-9 h-9 rounded-xl bg-[#6d4aff]/18 text-[#a78bff] flex items-center justify-center shrink-0 mt-0.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-white mb-1.5">In plain language</p>
                  <p className="text-[13px] text-white/48 leading-relaxed">
                    Sendora is telling you: <em className="text-white/70 not-italic">&ldquo;This recipient&apos;s email domain has strict security settings.
                    Your message was delivered, and the recipient&apos;s domain actively prevents spoofed or forged messages.&rdquo;</em>
                    This is a sign of a well-configured, professional mail infrastructure.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              {/* Visual: Authentication flow */}
              <div className="rounded-2xl bg-[#0d0b1e] border border-white/[0.07] overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400/50" />
                  <span className="ml-2 text-[11px] text-white/20 font-mono">DNS Authentication Lookup · sendora.me</span>
                </div>
                <div className="p-5 font-mono text-[12px] space-y-3">
                  {[
                    { key: "SPF", val: "v=spf1 include:_spf.sendora.me ~all", color: "text-emerald-400" },
                    { key: "DKIM", val: "v=DKIM1; k=rsa; p=MIIBIjANBgkq...", color: "text-sky-400" },
                    { key: "DMARC", val: "v=DMARC1; p=reject; rua=mailto:dmarc@sendora.me", color: "text-violet-400" },
                    { key: "MX", val: "10 mx1.sendora.me · 20 mx2.sendora.me", color: "text-amber-400" },
                    { key: "DANE", val: "TLSA 3 1 1 [SHA-256 hash of TLS cert]", color: "text-pink-400" },
                    { key: "MTA-STS", val: "version: STSv1; mode: enforce; max_age: 604800", color: "text-teal-400" },
                  ].map(({ key, val, color }) => (
                    <div key={key} className="flex gap-3 items-start group">
                      <span className={`shrink-0 text-[11px] font-bold w-14 text-right ${color} opacity-80 group-hover:opacity-100 transition-opacity`}>{key}</span>
                      <span className="text-white/[0.28] group-hover:text-white/45 transition-colors break-all leading-relaxed">{val}</span>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-white/[0.05] flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] text-emerald-400/70 font-medium">All authentication records verified</span>
                </div>
              </div>

              {/* Verdict chip */}
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: "SPF", status: "Pass", color: "border-emerald-500/25 bg-emerald-500/08 text-emerald-400" },
                  { label: "DKIM", status: "Pass", color: "border-sky-500/25 bg-sky-500/08 text-sky-400" },
                  { label: "DMARC", status: "Pass", color: "border-violet-500/25 bg-violet-500/08 text-violet-400" },
                ].map(({ label, status, color }) => (
                  <div key={label} className={`rounded-xl border px-3 py-2.5 text-center ${color}`}>
                    <div className="text-[11px] font-bold uppercase tracking-wider">{label}</div>
                    <div className="text-[13px] font-extrabold mt-0.5">{status}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Authentication Protocols ── */}
      <section id="authentication" className="border-t border-white/[0.05] bg-[#0a0918]">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <SectionLabel>Email Authentication Protocols</SectionLabel>
          <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-4">
            The three pillars of authenticated<br className="hidden sm:block" /> email delivery
          </h2>
          <p className="text-[14px] text-white/42 max-w-2xl leading-relaxed mb-14">
            Modern authenticated email delivery is built upon three complementary DNS-based protocols.
            Sendora implements all three — and extends beyond them with additional hardening mechanisms — to ensure
            that every message can be cryptographically verified and that our domain cannot be impersonated.
          </p>

          <div className="space-y-5">
            {[
              {
                acronym: "SPF",
                name: "Sender Policy Framework",
                rfc: "RFC 7208",
                color: "emerald",
                description: "SPF is a DNS TXT record that enumerates the IP addresses and mail server hostnames that are authorised to send email on behalf of a domain. When a receiving mail server (such as Sendora's MX infrastructure) accepts an inbound message claiming to originate from sendora.me, it performs a DNS lookup of our SPF record and verifies that the sending server's IP address is included in that record. If the IP is not listed, the message fails SPF — which, combined with our DMARC policy, causes Sendora to reject or quarantine the message before it reaches any inbox.",
                mechanism: [
                  "DNS TXT record at the apex domain",
                  "Enumerates authorised sending IP ranges",
                  "Evaluated by the receiving MTA on every inbound message",
                  "Result: Pass / Fail / Softfail / Neutral",
                ],
                record: 'v=spf1 ip4:103.x.x.0/24 include:_spf.sendora.me -all',
              },
              {
                acronym: "DKIM",
                name: "DomainKeys Identified Mail",
                rfc: "RFC 6376",
                color: "sky",
                description: "DKIM attaches a cryptographic signature to outgoing email headers using a private key held exclusively by Sendora's mail servers. The corresponding public key is published in DNS. When Sendora or any receiving mail server receives a Sendora-originated message, it retrieves our public key from DNS and uses it to verify the signature. If the signature is valid, the message is confirmed as genuinely originating from Sendora's infrastructure and unmodified in transit. We use RSA-2048 keys, rotated on a defined schedule, with dedicated selectors per mail-handling cluster for granular auditability.",
                mechanism: [
                  "RSA-2048 cryptographic signature on message headers",
                  "Private key held exclusively by Sendora MTA cluster",
                  "Public key published in DNS (DKIM selector records)",
                  "Covers: From, Subject, Date, and message body hash",
                ],
                record: 'selector1._domainkey.sendora.me IN TXT "v=DKIM1; k=rsa; p=MIIBIjAN..."',
              },
              {
                acronym: "DMARC",
                name: "Domain-based Message Authentication, Reporting & Conformance",
                rfc: "RFC 7489",
                color: "violet",
                description: "DMARC is the policy layer that ties SPF and DKIM together and instructs receiving mail servers how to handle messages that fail authentication. Sendora's DMARC policy is set to p=reject — the most aggressive enforcement mode. This means that any message purporting to originate from a sendora.me address that fails both SPF and DKIM alignment will be unconditionally rejected by Sendora and all DMARC-compliant mail servers worldwide. We additionally configure rua and ruf URIs so that aggregate and forensic failure reports are sent to our postmaster team, enabling continuous monitoring of authentication failures and potential spoofing attempts.",
                mechanism: [
                  "p=reject: failed messages are unconditionally rejected",
                  "Alignment mode: strict (aspf=s; adkim=s)",
                  "Aggregate reports (rua) delivered daily to postmaster",
                  "Forensic reports (ruf) on each authentication failure",
                ],
                record: 'v=DMARC1; p=reject; rua=mailto:dmarc@sendora.me; aspf=s; adkim=s',
              },
            ].map(({ acronym, name, rfc, color, description, mechanism, record }) => {
              const colorMap: Record<string, { border: string; bg: string; text: string; pill: string }> = {
                emerald: { border: "border-emerald-500/20", bg: "bg-emerald-500/05", text: "text-emerald-400", pill: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
                sky: { border: "border-sky-500/20", bg: "bg-sky-500/05", text: "text-sky-400", pill: "bg-sky-500/15 text-sky-400 border-sky-500/25" },
                violet: { border: "border-violet-500/20", bg: "bg-violet-500/05", text: "text-violet-400", pill: "bg-violet-500/15 text-violet-400 border-violet-500/25" },
              };
              const c = colorMap[color];
              return (
                <div key={acronym} className={`rounded-2xl border ${c.border} ${c.bg} hover:border-opacity-40 transition-all duration-300 overflow-hidden`}>
                  <div className="grid lg:grid-cols-3 gap-0">
                    <div className="p-7 lg:border-r border-b lg:border-b-0 border-white/[0.05]">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <p className={`text-[28px] font-black tracking-tight ${c.text}`}>{acronym}</p>
                          <p className="text-[13px] font-semibold text-white/60 mt-1 leading-snug">{name}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full border uppercase tracking-wider shrink-0 mt-1 ${c.pill}`}>{rfc}</span>
                      </div>
                      <div className="space-y-2 mt-5">
                        {mechanism.map((m) => (
                          <div key={m} className="flex items-start gap-2.5">
                            <div className={`w-1 h-1 rounded-full mt-2 shrink-0 ${c.text}`} />
                            <span className="text-[12px] text-white/40 leading-relaxed">{m}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="lg:col-span-2 p-7 flex flex-col gap-5">
                      <p className="text-[13.5px] text-white/50 leading-[1.85]">{description}</p>
                      <div className="mt-auto p-4 rounded-xl bg-black/30 font-mono text-[11px] text-white/30 break-all leading-relaxed border border-white/[0.04]">
                        <span className="text-white/18 mr-2 select-none">DNS&gt;</span>
                        {record}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Encryption Stack ── */}
      <section id="encryption" className="border-t border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <SectionLabel>Encryption Stack</SectionLabel>
          <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-4">
            Multi-layer encryption architecture
          </h2>
          <p className="text-[14px] text-white/42 max-w-2xl leading-relaxed mb-14">
            Sendora&apos;s security model enforces encryption at every layer of the communication stack — from the
            transport channel that carries messages between servers, to the storage subsystem that persists data at rest.
            Each layer is independently cryptographically hardened so that a failure in one layer does not expose data
            protected by the others.
          </p>

          {/* Layer diagram */}
          <div className="relative mb-14">
            <div className="absolute left-8 top-8 bottom-8 w-px bg-gradient-to-b from-[#6d4aff]/60 via-[#6d4aff]/30 to-transparent hidden md:block" />
            <div className="space-y-3">
              {[
                {
                  layer: "L1",
                  label: "MTA-STS · DANE · TLSA",
                  algo: "Policy Enforcement Layer",
                  desc: "Before any encrypted channel is established, Sendora's mail servers enforce MTA-STS (Mail Transfer Agent Strict Transport Security) and DANE (DNS-Based Authentication of Named Entities). MTA-STS publishes a machine-readable policy via HTTPS mandating that all SMTP connections to sendora.me must use TLS — no plaintext fallback is permitted. DANE goes further: it pins the expected TLS certificate fingerprint in DNS, secured by DNSSEC, so that even a compromised certificate authority cannot issue a fraudulent certificate that would be trusted by our SMTP infrastructure.",
                  badge: "Active · Enforced",
                  badgeColor: "text-amber-400 bg-amber-400/10 border-amber-400/25",
                },
                {
                  layer: "L2",
                  label: "TLS 1.3 / STARTTLS",
                  algo: "Transport Encryption (In-Transit)",
                  desc: "All SMTP connections between external mail servers and Sendora's MX servers are encrypted using TLS 1.3 with ECDHE key exchange, providing forward secrecy by default. When a Sendora server delivers a message to sendora.me, the connection is upgraded to TLS via STARTTLS before any message data is transmitted. Cipher suites below AES-128-GCM or CHACHA20-POLY1305 are rejected. TLS 1.0 and 1.1 are disabled entirely. HSTS headers on webmail ensure browser connections are always encrypted.",
                  badge: "TLS 1.3 · PFS",
                  badgeColor: "text-sky-400 bg-sky-400/10 border-sky-400/25",
                },
                {
                  layer: "L3",
                  label: "AES-256-GCM at Rest",
                  algo: "Database & Object Storage Encryption",
                  desc: "Once delivered, email content, attachments, account metadata, and all associated records are persisted in databases encrypted at rest using AES-256-GCM (Galois/Counter Mode) — an authenticated encryption scheme that simultaneously ensures confidentiality and integrity. The encryption keys are managed in a dedicated key management service (KMS), with key rotation occurring on a 90-day cycle. Envelope encryption is employed: individual data records are encrypted under unique data encryption keys (DEKs), which are themselves encrypted under master key encryption keys (KEKs) held in the KMS.",
                  badge: "AES-256-GCM · KMS",
                  badgeColor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
                },
                {
                  layer: "L4",
                  label: "Application-Layer Hashing",
                  algo: "Credential & Sensitive-Data Hashing",
                  desc: "Passwords and other sensitive credentials are never stored in recoverable form. They are hashed using Argon2id, the winner of the Password Hashing Competition, configured with tuned memory and time cost parameters that make brute-force and GPU-accelerated dictionary attacks computationally infeasible. A unique cryptographic salt is generated per credential using a cryptographically secure pseudorandom number generator (CSPRNG), preventing precomputed table attacks. Recovery keys are derived from high-entropy random byte sequences and are only ever shown to the user once — never stored server-side.",
                  badge: "Argon2id · CSPRNG",
                  badgeColor: "text-violet-400 bg-violet-400/10 border-violet-400/25",
                },
              ].map(({ layer, label, algo, desc, badge, badgeColor }) => (
                <div key={layer} className="md:pl-20 relative group">
                  <div className="absolute left-4 top-7 w-9 h-9 rounded-full bg-[#6d4aff]/20 border border-[#6d4aff]/35 text-[#a78bff] flex items-center justify-center text-[10px] font-extrabold hidden md:flex group-hover:bg-[#6d4aff]/35 transition-colors">
                    {layer}
                  </div>
                  <div className="p-6 rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-[#6d4aff]/20 hover:bg-white/[0.035] transition-all duration-300">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="text-[11px] text-white/25 font-medium uppercase tracking-wider mb-1">{algo}</p>
                        <p className="text-[16px] font-bold text-white tracking-tight">{label}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${badgeColor}`}>{badge}</span>
                    </div>
                    <p className="text-[13px] text-white/45 leading-[1.85]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cipher suite matrix */}
          <div className="rounded-2xl bg-[#0d0b1e] border border-white/[0.07] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
              <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-white/30">Accepted TLS Cipher Suites — SMTP & HTTPS</p>
              <span className="text-[11px] text-emerald-400/70 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Current configuration
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    {["Cipher Suite", "Key Exchange", "Auth", "Encryption", "MAC", "Forward Secrecy"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-white/20">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { suite: "TLS_AES_256_GCM_SHA384", kex: "ECDHE (P-384)", auth: "ECDSA / RSA", enc: "AES-256-GCM", mac: "SHA-384", pfs: true },
                    { suite: "TLS_CHACHA20_POLY1305_SHA256", kex: "ECDHE (X25519)", auth: "ECDSA / RSA", enc: "ChaCha20-Poly1305", mac: "SHA-256", pfs: true },
                    { suite: "TLS_AES_128_GCM_SHA256", kex: "ECDHE (P-256)", auth: "ECDSA / RSA", enc: "AES-128-GCM", mac: "SHA-256", pfs: true },
                    { suite: "ECDHE-RSA-AES256-GCM-SHA384 (TLS 1.2 fallback)", kex: "ECDHE", auth: "RSA-2048+", enc: "AES-256-GCM", mac: "SHA-384", pfs: true },
                  ].map(({ suite, kex, auth, enc, mac, pfs }, idx) => (
                    <tr key={suite} className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${idx === 0 ? "bg-white/[0.015]" : ""}`}>
                      <td className="px-5 py-3.5 font-mono text-white/50">{suite}</td>
                      <td className="px-5 py-3.5 text-sky-400/70">{kex}</td>
                      <td className="px-5 py-3.5 text-white/35">{auth}</td>
                      <td className="px-5 py-3.5 text-emerald-400/70">{enc}</td>
                      <td className="px-5 py-3.5 text-white/35">{mac}</td>
                      <td className="px-5 py-3.5">
                        {pfs && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-500/12 text-emerald-400 border border-emerald-500/20">Yes</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── Zero-Knowledge Architecture ── */}
      <section id="architecture" className="border-t border-white/[0.05] bg-[#0a0918]">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <SectionLabel>Zero-Knowledge Architecture</SectionLabel>
          <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-4">
            Designed so that <em className="not-italic text-[#a78bff]">even we</em><br className="hidden sm:block" /> cannot read your mail
          </h2>
          <p className="text-[14px] text-white/42 max-w-2xl leading-relaxed mb-14">
            Sendora&apos;s infrastructure is designed around a zero-knowledge model: architectural and procedural
            controls are in place to minimise the extent to which Sendora personnel can access the content of
            user communications, even in scenarios where server infrastructure is fully accessible to an operator.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
                title: "Password Hashing at the Edge",
                body: "User passwords are hashed client-side (using Argon2id in the browser) before they are transmitted over HTTPS to our servers. The server never receives the plaintext password. The server stores only the derived hash. Even a full database dump reveals no recoverable credentials.",
              },
              {
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
                title: "Deterministic Alias Derivation",
                body: "Temporary inbox aliases and anonymous sending addresses are derived using a deterministic cryptographic function keyed to the user's account identity. No lookup table maps aliases to accounts — the mapping is computable only with knowledge of the cryptographic key, which is never stored in the same tier as the alias data.",
              },
              {
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>,
                title: "Session Token Isolation",
                body: "Authentication session tokens are generated as cryptographically random 256-bit values, stored in an isolated Redis cluster with TTL-based expiry, and are never embedded in URLs. Tokens are bound to the originating IP and User-Agent at issuance. Token rotation occurs on every elevation of privilege.",
              },
              {
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                title: "Role-Based Access with Audit",
                body: "Access to production infrastructure is controlled by strict role-based access policies. No single engineer has broad read access to the mail storage tier. All access to sensitive systems is logged, reviewed on a weekly basis, and cross-referenced against legitimate operational tickets in our internal incident management system.",
              },
              {
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
                title: "No Advertising Data Pipeline",
                body: "Sendora has no advertising technology stack, no third-party tracking pixel SDK, and no data-sharing agreements with advertising platforms. There is no data pipeline from our mail infrastructure to any external analytics, data broker, or advertising exchange. Email content is never parsed for advertising purposes.",
              },
              {
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
                title: "Rate Limiting & Abuse Detection",
                body: "All unauthenticated API endpoints are subject to progressive rate limiting. Authenticated endpoints enforce per-user and per-IP request quotas at the load balancer layer, preventing both brute-force credential attacks and large-scale scraping. Anomalous access patterns trigger automated temporary lockout and postmaster alerting.",
              },
            ].map(({ icon, title, body }) => (
              <div key={title} className="group p-6 rounded-2xl bg-white/[0.025] border border-white/[0.06] hover:border-[#6d4aff]/25 hover:bg-white/[0.035] transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-[#6d4aff]/15 text-[#a78bff] flex items-center justify-center mb-5 group-hover:bg-[#6d4aff]/25 transition-colors">
                  {icon}
                </div>
                <h3 className="text-[14px] font-bold text-white mb-2.5 leading-snug">{title}</h3>
                <p className="text-[13px] text-white/42 leading-[1.8]">{body}</p>
              </div>
            ))}
          </div>

          {/* Trust chain visual */}
          <div className="mt-14 p-8 rounded-2xl bg-[#0d0b1e] border border-white/[0.07]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/25 mb-8">Email Trust Chain · Inbound Message Verification Flow</p>
            <div className="flex flex-col sm:flex-row items-stretch gap-0 overflow-x-auto">
              {[
                { node: "Sendora MTA", sub: "Sender's server", color: "bg-[#4285f4]/15 border-[#4285f4]/25 text-[#4285f4]" },
                { node: "DNS Lookup", sub: "SPF + DKIM + DMARC", color: "bg-amber-500/12 border-amber-500/25 text-amber-400" },
                { node: "TLS 1.3 Handshake", sub: "STARTTLS + DANE", color: "bg-sky-500/12 border-sky-500/25 text-sky-400" },
                { node: "MX Reception", sub: "mx1 / mx2.sendora.me", color: "bg-[#6d4aff]/15 border-[#6d4aff]/30 text-[#a78bff]" },
                { node: "Auth Validation", sub: "Header alignment", color: "bg-violet-500/12 border-violet-500/25 text-violet-400" },
                { node: "AES-256 Storage", sub: "Encrypted at rest", color: "bg-emerald-500/12 border-emerald-500/25 text-emerald-400" },
              ].map(({ node, sub, color }, i, arr) => (
                <div key={node} className="flex sm:flex-col items-center gap-0 flex-1 min-w-0">
                  <div className={`flex-1 sm:flex-none sm:w-full rounded-xl border px-3 py-4 text-center ${color} hover:opacity-100 opacity-80 transition-opacity`}>
                    <p className="text-[13px] font-bold leading-snug">{node}</p>
                    <p className="text-[10px] opacity-70 mt-0.5 leading-snug">{sub}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="sm:mx-auto flex sm:flex-col items-center justify-center px-1.5 sm:px-0 sm:py-2 shrink-0">
                      <div className="hidden sm:block w-px h-4 bg-white/10" />
                      <div className="w-3 h-3 text-white/15">
                        <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3 rotate-90 sm:rotate-0">
                          <path d="M6 1l5 5-5 5M1 6h10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div className="hidden sm:block w-px h-4 bg-white/10" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Infrastructure ── */}
      <section className="border-t border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <SectionLabel>Mail Infrastructure</SectionLabel>
          <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-4">
            Carrier-grade mail infrastructure<br className="hidden sm:block" /> built for reliability
          </h2>
          <p className="text-[14px] text-white/42 max-w-2xl leading-relaxed mb-14">
            Sendora&apos;s mail exchange infrastructure is distributed across multiple availability zones with
            automatic failover, ensuring that messages addressed to sendora.me are accepted reliably 24/7/365.
          </p>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              {[
                { label: "MX Record Redundancy", value: "Primary + Secondary (Priority 10/20)", status: "Operational" },
                { label: "Inbound Queue Processing", value: "Real-time with 99.98% delivery rate", status: "Operational" },
                { label: "Spam & Malware Filtering", value: "Multi-layer heuristic + ML classification", status: "Active" },
                { label: "DNSSEC Signing", value: "Enabled on all Sendora-managed zones", status: "Signed" },
                { label: "Reverse DNS (PTR Records)", value: "Fully configured for all outbound IPs", status: "Configured" },
                { label: "Postmaster Tools Registered", value: "Google · Microsoft · Yahoo · AOL", status: "Verified" },
                { label: "IP Reputation Monitoring", value: "Continuous — automated escalation on block", status: "Monitoring" },
                { label: "Bounce Management", value: "RFC 3464 NDRs · Automated suppression", status: "Active" },
              ].map(({ label, value, status }) => (
                <div key={label} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.025] border border-white/[0.05] hover:border-[#6d4aff]/18 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-white/70 leading-snug">{label}</p>
                    <p className="text-[12px] text-white/35 mt-0.5 leading-snug">{value}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/12 text-emerald-400/80 border border-emerald-500/20">{status}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-5">
              <div className="p-7 rounded-2xl bg-[#0d0b1e] border border-white/[0.07] flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/22 mb-6">Delivery Infrastructure Uptime · 90-Day Rolling</p>
                <div className="space-y-4">
                  {[
                    { service: "MX Inbound (mx1)", uptime: "99.97%", bars: 30 },
                    { service: "MX Inbound (mx2)", uptime: "99.98%", bars: 30 },
                    { service: "SMTP Outbound", uptime: "99.94%", bars: 30 },
                    { service: "Webmail API", uptime: "99.91%", bars: 30 },
                    { service: "DNS Resolution", uptime: "100.0%", bars: 30 },
                  ].map(({ service, uptime, bars }) => (
                    <div key={service}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[12px] text-white/50 font-medium">{service}</span>
                        <span className="text-[12px] font-bold text-emerald-400">{uptime}</span>
                      </div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: bars }, (_, i) => (
                          <div
                            key={i}
                            className={`flex-1 h-4 rounded-sm ${i === 7 || i === 22 ? "bg-amber-400/50" : "bg-emerald-400/60"} hover:opacity-100 opacity-75 transition-opacity`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex items-center gap-4 text-[11px] text-white/22">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400/60" /> Operational</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400/50" /> Degraded</span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-gradient-to-br from-[#6d4aff]/10 to-[#6d4aff]/05 border border-[#6d4aff]/20">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#6d4aff]/20 text-[#a78bff] flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-white mb-1.5">SLA & Reliability Commitment</p>
                    <p className="text-[13px] text-white/45 leading-relaxed">
                      Business and Enterprise plan subscribers receive a contractual 99.9% uptime SLA for
                      inbound mail reception, backed by a service credit scheme. Sendora&apos;s status page
                      provides real-time infrastructure visibility at <span className="text-[#a78bff] font-mono text-[12px]">status.sendora.me</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Privacy & Compliance ── */}
      <section id="compliance" className="border-t border-white/[0.05] bg-[#0a0918]">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <SectionLabel>Privacy & Compliance</SectionLabel>
          <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-4">
            Regulatory compliance &amp; privacy<br className="hidden sm:block" /> framework
          </h2>
          <p className="text-[14px] text-white/42 max-w-2xl leading-relaxed mb-14">
            Sendora operates in compliance with applicable data protection and privacy regulations, and applies
            privacy-by-design principles throughout the product architecture. Below is a reference of the
            regulatory frameworks, standards, and principles under which we operate.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {[
              {
                framework: "GDPR",
                name: "General Data Protection Regulation",
                jurisdiction: "European Union",
                summary: "Sendora processes personal data of EU-resident users under the principles of data minimisation, purpose limitation, and storage limitation as mandated by the GDPR. Our Privacy Policy constitutes a data processing notice under Article 13/14. Users have the right to access, rectify, erase, and export their personal data via their account settings.",
                color: "blue",
              },
              {
                framework: "IT Act 2000",
                name: "Information Technology Act & DPDP Act 2023",
                jurisdiction: "India",
                summary: "As an Indian-incorporated platform, Sendora complies with the Information Technology Act 2000, the IT (Reasonable Security Practices) Rules 2011, and the Digital Personal Data Protection Act 2023. All user data stored on Sendora's primary infrastructure resides within Indian data centre boundaries, in compliance with localisation provisions.",
                color: "amber",
              },
              {
                framework: "CAN-SPAM",
                name: "Controlling the Assault of Non-Solicited Pornography And Marketing Act",
                jurisdiction: "United States",
                summary: "Sendora's outbound email systems are configured to comply with CAN-SPAM requirements for commercial messaging. Transactional and account messages are clearly identified. Sendora does not send unsolicited commercial email. Abuse reports are processed within 24 hours of receipt via our postmaster and abuse reporting channels.",
                color: "emerald",
              },
              {
                framework: "ISO 27001",
                name: "Information Security Management System",
                jurisdiction: "International Standard",
                summary: "Sendora's engineering and operations practices are aligned with ISO/IEC 27001 security management principles, including risk assessment, access control, cryptographic controls, incident response, and business continuity. A formal ISO 27001 certification engagement is part of our enterprise roadmap.",
                color: "violet",
              },
            ].map(({ framework, name, jurisdiction, summary, color }) => {
              const c: Record<string, string> = {
                blue: "border-blue-500/20 bg-blue-500/05 text-blue-400",
                amber: "border-amber-500/20 bg-amber-500/05 text-amber-400",
                emerald: "border-emerald-500/20 bg-emerald-500/05 text-emerald-400",
                violet: "border-violet-500/20 bg-violet-500/05 text-violet-400",
              };
              return (
                <div key={framework} className={`p-6 rounded-2xl border bg-white/[0.015] hover:bg-white/[0.03] transition-colors border-white/[0.07]`}>
                  <div className="flex items-start gap-4 mb-4">
                    <span className={`text-[12px] font-extrabold px-3 py-1.5 rounded-xl border ${c[color]} shrink-0`}>{framework}</span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-white leading-snug">{name}</p>
                      <p className="text-[11px] text-white/30 mt-0.5">{jurisdiction}</p>
                    </div>
                  </div>
                  <p className="text-[13px] text-white/42 leading-[1.85]">{summary}</p>
                </div>
              );
            })}
          </div>

          {/* Data minimisation table */}
          <div className="rounded-2xl bg-[#0d0b1e] border border-white/[0.07] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.05]">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/25">Data Collection Inventory — What We Store vs. What We Don&apos;t</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-white/20">Data Type</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-white/20">Collected</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-white/20">Purpose</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-white/20">Retention</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { type: "Email address (chosen by user)", collected: true, purpose: "Account identity & mail routing", retention: "Lifetime of account" },
                    { type: "Password (hashed, irreversible)", collected: true, purpose: "Authentication", retention: "Lifetime of account" },
                    { type: "Email content & attachments", collected: true, purpose: "Mail delivery & inbox display", retention: "Until deleted by user" },
                    { type: "IP address (last login)", collected: true, purpose: "Security & abuse detection", retention: "90 days rolling" },
                    { type: "Phone number", collected: false, purpose: "—", retention: "—" },
                    { type: "Real name / identity documents", collected: false, purpose: "—", retention: "—" },
                    { type: "Third-party tracking cookies", collected: false, purpose: "—", retention: "—" },
                    { type: "Advertising identifiers", collected: false, purpose: "—", retention: "—" },
                    { type: "Message content for analytics", collected: false, purpose: "—", retention: "—" },
                  ].map(({ type, collected, purpose, retention }, idx) => (
                    <tr key={type} className={`border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors ${idx % 2 === 0 ? "bg-white/[0.008]" : ""}`}>
                      <td className="px-5 py-3.5 text-white/55">{type}</td>
                      <td className="px-5 py-3.5">
                        {collected ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-500/12 text-emerald-400 border border-emerald-500/20">Yes</span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-red-500/10 text-red-400/70 border border-red-500/15">No</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-white/32">{purpose}</td>
                      <td className="px-5 py-3.5 text-white/32">{retention}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── Advanced Protections ── */}
      <section className="border-t border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <SectionLabel>Advanced Hardening</SectionLabel>
          <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-4">
            Beyond the standard:<br className="hidden sm:block" /> supplementary hardening measures
          </h2>
          <p className="text-[14px] text-white/42 max-w-2xl leading-relaxed mb-14">
            In addition to baseline SPF/DKIM/DMARC compliance, Sendora implements a range of supplementary
            hardening mechanisms across the mail delivery path, the web application layer, and the DNS infrastructure.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[
              { label: "BIMI", detail: "Brand Indicators for Message Identification — our verified logo appears in Sendora alongside authenticated messages from sendora.me", tag: "Active" },
              { label: "MTA-STS", detail: "RFC 8461 policy enforces TLS on all inbound SMTP. Downgrade attacks that strip STARTTLS are rejected at the policy level before any data is exchanged.", tag: "Enforced" },
              { label: "DANE / TLSA", detail: "DNS-Based Authentication of Named Entities pins our TLS certificate fingerprint in DNSSEC-signed DNS records, defeating certificate authority compromise attacks.", tag: "Active" },
              { label: "DNSSEC", detail: "All Sendora-managed DNS zones are signed with DNSSEC, preventing DNS cache poisoning and spoofed DNS responses from redirecting mail delivery.", tag: "Signed" },
              { label: "TLS Reporting (TLSRPTs)", detail: "RFC 8460 TLS reporting is enabled — any MTA that fails to establish an encrypted connection to our servers automatically submits a JSON failure report to our postmaster.", tag: "Active" },
              { label: "Postmaster Tools", detail: "Sendora's sending IP ranges and domain reputation are actively monitored via Google Postmaster Tools, Microsoft SNDS, and Yahoo Postmaster, with automated alerting on reputation drops.", tag: "Monitored" },
              { label: "HSTS", detail: "HTTP Strict Transport Security with a 1-year max-age and includeSubDomains is published on all Sendora web properties, preventing protocol downgrade and SSL-stripping attacks.", tag: "Preloaded" },
              { label: "CSP", detail: "A strict Content Security Policy is enforced on all webmail pages, restricting script execution to known-safe origins and preventing cross-site scripting attacks at the browser enforcement layer.", tag: "Strict" },
              { label: "SRI", detail: "Subresource Integrity hashes are applied to all third-party static asset inclusions, ensuring that a compromised CDN cannot inject malicious JavaScript into the webmail interface.", tag: "Active" },
              { label: "CAA Records", detail: "Certification Authority Authorisation DNS records restrict which certificate authorities are permitted to issue TLS certificates for sendora.me domains, preventing misissued certificates.", tag: "Restricted" },
              { label: "IP Allowlisting", detail: "Administrative and infrastructure management access is restricted to a static set of allowlisted IP ranges. Remote access outside of these ranges is not possible regardless of credential validity.", tag: "Enforced" },
              { label: "Dependency Scanning", detail: "All software dependencies in the Sendora platform are continuously scanned against known CVE databases. Patches for critical vulnerabilities are deployed within 24 hours of disclosure.", tag: "Continuous" },
            ].map(({ label, detail, tag }) => (
              <div key={label} className="group p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-[#6d4aff]/22 hover:bg-white/[0.035] transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-extrabold text-white">{label}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#6d4aff]/15 text-[#a78bff] border border-[#6d4aff]/25">{tag}</span>
                </div>
                <p className="text-[12px] text-white/38 leading-[1.75]">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="border-t border-white/[0.05] bg-[#0a0918]">
        <div className="mx-auto max-w-4xl px-6 py-20 sm:py-24">
          <SectionLabel>Frequently Asked Questions</SectionLabel>
          <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-12">
            Common questions about<br className="hidden sm:block" /> the &ldquo;Protected message&rdquo; indicator
          </h2>

          <div className="space-y-4">
            {[
              {
                q: "Is there a problem with the email I sent to a sendora.me address?",
                a: "No. The 'Protected message' indicator does not indicate any problem with your message or your account. It is Sendora's way of communicating that the destination domain has strict authentication controls. Your message was accepted and delivered to the recipient's inbox.",
              },
              {
                q: "Why does my email show 'Signed-by: Unavailable' in the Sendora header?",
                a: "The 'Signed-by' field in Sendora refers to the DKIM signing domain of the message — which reflects your own sending domain (gmail.com, in the case of Sendora users), not the recipient's domain. 'Unavailable' in some contexts may indicate that Sendora's UI is showing you the authentication status from the sender's perspective rather than the receiving infrastructure's. The Sendora-side DKIM authentication is evaluated by our own MX servers, which is separate from what Sendora displays in the outbound view.",
              },
              {
                q: "Does Sendora read my emails after they are delivered?",
                a: "Sendora does not parse, analyse, or process the content of delivered email messages for any purpose other than delivery and display to the account holder. We do not have an advertising platform, and email content is never shared with third parties. Our engineers cannot read your mail content without explicit user-initiated support access, which is governed by strict access controls and audit logging.",
              },
              {
                q: "Is Sendora end-to-end encrypted?",
                a: "Messages in transit are encrypted using TLS 1.3 between mail servers. Messages at rest are encrypted using AES-256-GCM in our storage infrastructure. Full end-to-end encryption (where content is encrypted on the sender's device and decryptable only by the recipient's device) is on our development roadmap and will be available as an opt-in feature. We are transparent about this distinction in our security documentation.",
              },
              {
                q: "Can I send emails to a sendora.me address from any email provider?",
                a: "Yes. Sendora's MX servers accept inbound mail from all sending domains, subject to spam and abuse filtering. The authentication controls we implement do not restrict which senders can deliver to sendora.me addresses — they restrict who can impersonate sendora.me as a sender. There is no barrier to receiving mail from Sendora, Outlook, Yahoo, or any other provider.",
              },
              {
                q: "What happens if an email fails DMARC for my domain?",
                a: "If an email purporting to be from a sendora.me address fails DMARC alignment — meaning it fails both SPF and DKIM checks simultaneously — our DMARC policy instructs receiving mail servers to reject it (p=reject). This protects recipients from receiving forged or spoofed messages that appear to come from sendora.me. Failure reports are sent to our postmaster team for analysis.",
              },
              {
                q: "How can I verify Sendora's authentication records myself?",
                a: "You can independently verify our DNS records using any public DNS lookup tool. Check the TXT record for 'sendora.me' for SPF, the TXT record at a DKIM selector subdomain for our public key, and the TXT record at '_dmarc.sendora.me' for our DMARC policy. Tools such as MXToolbox, dmarcian, or Google's Admin Toolbox can provide a visual analysis of these records.",
              },
            ].map(({ q, a }, idx) => (
              <details key={idx} className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:border-[#6d4aff]/20 transition-colors overflow-hidden">
                <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none select-none">
                  <span className="text-[14px] font-semibold text-white/80 group-open:text-white transition-colors leading-snug">{q}</span>
                  <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0 group-open:bg-[#6d4aff]/20 transition-colors">
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-3 h-3 text-white/40 group-open:rotate-180 transition-transform duration-200">
                      <path d="M2 4l4 4 4-4"/>
                    </svg>
                  </div>
                </summary>
                <div className="px-6 pb-5 border-t border-white/[0.05] pt-4">
                  <p className="text-[13.5px] text-white/45 leading-[1.85]">{a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-white/[0.05] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d0b1e] via-[#0f0d22] to-[#080710]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_50%_50%,rgba(109,74,255,0.12),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-6 py-24 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-[#6d4aff]/15 border border-[#6d4aff]/25">
            <span className="w-1.5 h-1.5 rounded-full bg-[#a78bff] animate-pulse" />
            <span className="text-[11px] font-bold text-[#a78bff] uppercase tracking-wider">Start for free today</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.08] mb-5">
            Get your own<br />
            <span className="bg-gradient-to-r from-[#a78bff] via-[#8b6aff] to-[#6d4aff] bg-clip-text text-transparent">private @sendora.me address</span>
          </h2>
          <p className="text-[14px] sm:text-[15px] text-white/42 max-w-xl mx-auto leading-relaxed mb-10">
            Join millions of users who trust Sendora for private, encrypted, ad-free email.
            No phone number. No tracking. Free forever.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-[#6d4aff] hover:bg-[#5b3de8] text-white font-semibold text-[14px] transition-all duration-200 shadow-2xl shadow-[#6d4aff]/30 hover:shadow-[#6d4aff]/45"
            >
              Create your free account
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
              </svg>
            </Link>
            <Link
              href="/security"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full text-white/50 hover:text-white/85 font-medium text-[14px] transition-colors border border-white/[0.08] hover:border-white/[0.18]"
            >
              Full security documentation
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-5 sm:gap-8">
            {["Free forever", "No phone number required", "End-to-end encrypted", "30-day guarantee"].map((item) => (
              <div key={item} className="flex items-center gap-1.5 text-[12px] text-white/28">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-[#6d4aff]">
                  <polyline points="2 6 5 9 10 3" />
                </svg>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05]">
        <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <img src="/sendora-logo.png" alt="Sendora" className="w-6 h-6 object-contain" />
              <span className="text-[13px] font-semibold text-white/40 tracking-tight">Sendora</span>
            </Link>
            <span className="text-white/10">·</span>
            <p className="text-[12px] text-white/20">© {new Date().getFullYear()} Sendora Technologies Pvt. Ltd.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[12px] text-white/25">
            <Link href="/" className="hover:text-white/55 transition-colors">Home</Link>
            <Link href="/about" className="hover:text-white/55 transition-colors">About</Link>
            <Link href="/security" className="hover:text-white/55 transition-colors text-[#a78bff]">Security</Link>
            <Link href="/privacy-policy" className="hover:text-white/55 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white/55 transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-white/55 transition-colors">Contact</Link>
            <Link href="/help" className="hover:text-white/55 transition-colors">Help</Link>
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
