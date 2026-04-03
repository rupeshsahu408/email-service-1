import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Security — Sendora",
  description:
    "A comprehensive overview of Sendora's security architecture, data encryption practices, infrastructure hardening, privacy controls, and compliance posture. Learn how we protect your communications.",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full bg-[#6d4aff]/10 border border-[#6d4aff]/20">
      <span className="text-[10px] font-bold text-[#a78bff] uppercase tracking-[0.18em]">{children}</span>
    </div>
  );
}

function PillBadge({ children, color = "violet" }: { children: React.ReactNode; color?: "violet" | "green" | "blue" | "orange" }) {
  const styles: Record<string, string> = {
    violet: "bg-[#6d4aff]/12 text-[#a78bff] border-[#6d4aff]/20",
    green:  "bg-green-500/10 text-green-400 border-green-500/20",
    blue:   "bg-sky-500/10 text-sky-400 border-sky-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold tracking-wide ${styles[color]}`}>
      {children}
    </span>
  );
}

function SecurityCard({
  icon,
  title,
  body,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex gap-5 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-[#6d4aff]/25 transition-colors">
      <div className="shrink-0 w-11 h-11 rounded-xl bg-[#6d4aff]/12 text-[#a78bff] flex items-center justify-center">
        {icon}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="font-semibold text-white text-[14.5px] leading-snug">{title}</p>
          {badge}
        </div>
        <p className="text-[13px] text-white/45 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function NumberCard({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/[0.025] border border-white/[0.06] flex flex-col gap-4 hover:border-[#6d4aff]/20 transition-colors">
      <span className="text-[11px] font-bold text-[#6d4aff]/60 tracking-[0.2em]">{number}</span>
      <h3 className="text-[15.5px] font-bold text-white leading-snug">{title}</h3>
      <p className="text-[13px] text-white/42 leading-relaxed">{body}</p>
    </div>
  );
}

export default function SecurityPage() {
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
              <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 7.078 2.749.5.5 0 0 1 .479.425c.069.52.104 1.05.104 1.59 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 0 1-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 0 1 .48-.425 11.947 11.947 0 0 0 7.077-2.749Zm4.196 5.954a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd"/>
            </svg>
            <span className="text-[11px] font-semibold text-[#a78bff] uppercase tracking-wider">Security at Sendora</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.08]">
            Security is not a feature.<br />
            <span className="bg-gradient-to-r from-[#a78bff] via-[#7c6aff] to-[#6d4aff] bg-clip-text text-transparent">
              It's our foundation.
            </span>
          </h1>
          <p className="text-[16px] sm:text-[17px] text-white/50 max-w-2xl mx-auto leading-relaxed">
            At Sendora, security is not a checkbox or a marketing claim — it is the architectural bedrock upon which
            every component of our platform is constructed. This page provides a transparent, comprehensive account
            of the technical and organisational security measures that protect your communications and data.
          </p>

          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
            {[
              { value: "Argon2id", label: "Password Hashing" },
              { value: "TLS 1.3", label: "Transport Encryption" },
              { value: "FIDO2", label: "Passkey Standard" },
              { value: "Zero", label: "Ads or Data Sales" },
            ].map(({ value, label }) => (
              <div key={label} className="bg-[#0d0b1e]/60 px-6 py-8 flex flex-col items-center gap-1.5">
                <span className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">{value}</span>
                <span className="text-[12px] text-white/35 font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security Overview ── */}
      <section className="border-t border-white/[0.05]" id="overview">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Overview</SectionLabel>
          <div className="mt-4 grid lg:grid-cols-2 gap-14 items-start">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug mb-6">
                A defence-in-depth architecture designed to protect you at every layer.
              </h2>
              <div className="flex flex-col gap-5 text-[15px] text-white/55 leading-[1.82]">
                <p>
                  Sendora's security architecture is built on the principle of defence-in-depth — the deliberate
                  application of multiple, independent layers of protection such that the failure of any single
                  control does not result in a catastrophic breach. This approach reflects a mature understanding
                  of the adversarial landscape in which a modern email service operates, and a commitment to
                  ensuring that your communications remain private and secure regardless of the attack vector
                  an adversary may attempt to exploit.
                </p>
                <p>
                  Every component of the Sendora platform — from the authentication layer and the database schema
                  to the email routing pipeline and the client-side rendering engine — has been designed with
                  security as a non-negotiable constraint, not an afterthought. Security reviews are conducted
                  as an integral part of every development cycle, not as a periodic compliance exercise.
                </p>
                <p>
                  We believe that genuine security requires transparency. This page documents, in precise technical
                  detail, the controls we have implemented on your behalf. We do not make unverifiable claims —
                  every security measure described here is an operational reality of our platform, not an
                  aspirational statement.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {[
                {
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
                    </svg>
                  ),
                  title: "Security by Design",
                  body: "Security requirements are established before implementation begins. Every feature is threat-modelled and reviewed before deployment.",
                  badge: <PillBadge color="violet">Core Principle</PillBadge>,
                },
                {
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  ),
                  title: "Least Privilege Access",
                  body: "Every internal system, service account, and personnel role operates with the minimum permissions required to perform its function — nothing more.",
                  badge: <PillBadge color="green">Active</PillBadge>,
                },
                {
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  ),
                  title: "Continuous Monitoring",
                  body: "Infrastructure, authentication events, and anomalous access patterns are monitored in real time, with automated alerting for suspicious activity.",
                  badge: <PillBadge color="green">24/7</PillBadge>,
                },
                {
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  ),
                  title: "Transparent Disclosure",
                  body: "We maintain a responsible disclosure programme and are committed to communicating security incidents to affected users with honesty and without delay.",
                  badge: <PillBadge color="blue">Open Policy</PillBadge>,
                },
              ].map(({ icon, title, body, badge }) => (
                <SecurityCard key={title} icon={icon} title={title} body={body} badge={badge} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Data Security & Encryption ── */}
      <section className="border-t border-white/[0.05] bg-gradient-to-b from-[#0c0a1e]/50 to-transparent" id="encryption">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Data Security & Encryption</SectionLabel>
          <div className="mt-4 mb-12 max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug mb-5">
              Your data is encrypted, hashed, and protected at every stage of its lifecycle.
            </h2>
            <p className="text-[15px] text-white/50 leading-relaxed">
              Sendora applies cryptographic protection to sensitive data both in transit and at rest,
              using algorithms and protocols that represent the current state of the art in applied
              cryptography — not the minimum standard required for regulatory compliance.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-5 mb-10">
            {[
              {
                tag: "Password Storage",
                algo: "Argon2id",
                color: "violet" as const,
                desc: "Sendora uses Argon2id — the winner of the Password Hashing Competition and the algorithm recommended by OWASP — for all password storage. Argon2id is a memory-hard function, meaning that brute-force attacks using GPU clusters or specialised ASICs are computationally prohibitive even with significant hardware resources. Passwords are never stored in plaintext, in reversible form, or using deprecated algorithms such as MD5, SHA-1, or bcrypt alone.",
              },
              {
                tag: "Transport Encryption",
                algo: "TLS 1.3",
                color: "green" as const,
                desc: "All communication between client browsers and Sendora's servers is encrypted using TLS 1.3 — the latest version of the Transport Layer Security protocol — with strong cipher suites and perfect forward secrecy (PFS). PFS ensures that even if a server's private key were compromised in the future, previously recorded sessions could not be decrypted. TLS 1.0 and 1.1 are explicitly disabled on all Sendora endpoints.",
              },
              {
                tag: "Session Tokens",
                algo: "Cryptographic PRNG",
                color: "blue" as const,
                desc: "Session tokens issued upon authentication are generated using a cryptographically secure pseudo-random number generator (CSPRNG), rendering them statistically immune to prediction or enumeration attacks. Tokens are stored server-side and are invalidated immediately upon logout, session expiry, or manual revocation. Each token is scoped to a specific device and IP range to limit portability.",
              },
              {
                tag: "Email Alias Routing",
                algo: "Cryptographic Derivation",
                color: "violet" as const,
                desc: "Anonymous Sending aliases and Temporary Inbox addresses are derived using a deterministic cryptographic function keyed to your account — not stored as plaintext mappings. This architectural choice ensures that even a complete disclosure of the alias routing table would not reveal the identity of the account holder without possession of the cryptographic key.",
              },
              {
                tag: "Database Encryption",
                algo: "AES-256 at Rest",
                color: "green" as const,
                desc: "All persistent data — including email content, account records, session metadata, and domain configurations — is stored in databases encrypted at rest using AES-256, the Advanced Encryption Standard with a 256-bit key, which is approved for the protection of classified information by national security agencies worldwide.",
              },
              {
                tag: "Email Transport",
                algo: "Opportunistic TLS (STARTTLS)",
                color: "blue" as const,
                desc: "When Sendora's mail servers communicate with external mail servers to deliver or receive email, we enforce opportunistic TLS via STARTTLS, upgrading connections to encrypted channels wherever the remote server supports it. We additionally implement DANE (DNS-Based Authentication of Named Entities) for supported domains to prevent downgrade attacks on mail transport encryption.",
              },
            ].map(({ tag, algo, color, desc }) => (
              <div key={tag} className="p-7 rounded-2xl bg-white/[0.025] border border-white/[0.07] hover:border-[#6d4aff]/25 transition-colors flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25 mb-1.5">{tag}</p>
                    <p className="text-[17px] font-extrabold text-white tracking-tight">{algo}</p>
                  </div>
                  <PillBadge color={color}>Active</PillBadge>
                </div>
                <div className="h-px bg-white/[0.06]" />
                <p className="text-[13px] text-white/48 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Key derivation note */}
          <div className="p-7 rounded-2xl bg-[#6d4aff]/08 border border-[#6d4aff]/15 flex gap-5">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-[#6d4aff]/15 text-[#a78bff] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-white mb-2">A note on end-to-end encryption</p>
              <p className="text-[13px] text-white/55 leading-relaxed">
                Full end-to-end encryption (E2EE) — where message content is encrypted on the sender's device and
                can only be decrypted by the recipient — is a capability currently in active development on our
                roadmap. When implemented, E2EE will be available as an opt-in feature for users who require the
                highest level of content confidentiality. Until then, all emails are protected by strong encryption
                in transit and at rest, with server-side access governed by the strict access controls described
                in this document.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Authentication Security ── */}
      <section className="border-t border-white/[0.05]" id="authentication">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Authentication Security</SectionLabel>
          <div className="mt-4 mb-12 max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug mb-5">
              Phishing-resistant, hardware-backed authentication as the default — not the exception.
            </h2>
            <p className="text-[15px] text-white/50 leading-relaxed">
              The authentication layer is the primary target of the majority of account compromise attempts.
              Sendora has invested significantly in authentication infrastructure that defeats the most prevalent
              attack categories — password theft, phishing, credential stuffing, and SIM-swap attacks — through
              architectural design rather than user vigilance alone.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-10">
            {/* Passkeys */}
            <div className="rounded-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-b from-[#110e28] to-[#0d0b1e]">
              <div className="px-8 py-7 border-b border-white/[0.06]">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#6d4aff]/15 text-[#a78bff] flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5.5 h-5.5">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25 mb-1">Primary Method</p>
                    <h3 className="text-[18px] font-extrabold text-white">Passkey Authentication</h3>
                  </div>
                </div>
                <p className="text-[13.5px] text-white/50 leading-relaxed">
                  Passkeys implement the WebAuthn/FIDO2 standard — a cryptographic authentication protocol developed
                  by the FIDO Alliance and the W3C and adopted by major platform vendors including Apple, Google, and
                  Microsoft. A passkey is a public/private key pair: the private key is stored in your device's secure
                  hardware enclave and never leaves your device, while the public key is registered with Sendora.
                  Authentication is performed by signing a server-issued challenge with the private key — a process
                  that requires your biometric (fingerprint or Face ID) or device PIN to authorise.
                </p>
              </div>
              <div className="px-8 py-6 flex flex-col gap-3">
                {[
                  { label: "Phishing resistant", desc: "The cryptographic challenge is domain-bound — it cannot be intercepted and replayed on a different domain." },
                  { label: "No credential transmission", desc: "Your private key and biometric are never sent to Sendora's servers. The challenge signature proves possession without exposure." },
                  { label: "Hardware-backed storage", desc: "Private keys are stored in the device's Trusted Platform Module (TPM), Secure Enclave, or equivalent protected storage — isolated from the operating system." },
                  { label: "Immune to credential stuffing", desc: "Passkeys are unique per service. A breach at another site cannot provide usable credentials for Sendora." },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex gap-3">
                    <div className="shrink-0 w-5 h-5 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center mt-0.5">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-green-400">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <div>
                      <span className="text-[13px] font-semibold text-white">{label} — </span>
                      <span className="text-[13px] text-white/45">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Session & Rate Limiting */}
            <div className="flex flex-col gap-5">
              <div className="p-7 rounded-2xl bg-white/[0.025] border border-white/[0.07] hover:border-[#6d4aff]/20 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#6d4aff]/12 text-[#a78bff] flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </div>
                  <h3 className="text-[15px] font-bold text-white">Session Management</h3>
                </div>
                <p className="text-[13px] text-white/48 leading-relaxed mb-4">
                  Sendora enforces automatic session expiration after a period of inactivity, and provides
                  full session audit logs — including device fingerprint, approximate geographic location,
                  and timestamp — allowing users to detect and revoke unauthorised sessions in real time.
                  Sessions are cryptographically scoped and cannot be transferred between devices or networks.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Inactivity Timeout", value: "Enforced" },
                    { label: "Session Audit Log", value: "Full History" },
                    { label: "Remote Revocation", value: "Per-Session" },
                    { label: "Token Rotation", value: "On Re-auth" },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25 mb-1">{label}</p>
                      <p className="text-[13px] font-semibold text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-7 rounded-2xl bg-white/[0.025] border border-white/[0.07] hover:border-[#6d4aff]/20 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#6d4aff]/12 text-[#a78bff] flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                  </div>
                  <h3 className="text-[15px] font-bold text-white">Rate Limiting & Bot Protection</h3>
                </div>
                <p className="text-[13px] text-white/48 leading-relaxed">
                  All authentication endpoints are protected by distributed rate limiting via Upstash Redis,
                  enforcing strict request thresholds per IP address, account identifier, and device fingerprint.
                  Login forms are additionally protected by Cloudflare Turnstile, an advanced bot-detection
                  mechanism that challenges automated scripts without degrading the experience for human users.
                  Credential stuffing attacks — in which attackers test large lists of compromised credentials
                  against login endpoints — are effectively neutralised by this combination of controls.
                </p>
              </div>

              <div className="p-7 rounded-2xl bg-white/[0.025] border border-white/[0.07] hover:border-[#6d4aff]/20 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#6d4aff]/12 text-[#a78bff] flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  </div>
                  <h3 className="text-[15px] font-bold text-white">Login Audit & Geolocation Alerts</h3>
                </div>
                <p className="text-[13px] text-white/48 leading-relaxed">
                  Every login event is recorded with an anonymised geolocation derived from the source IP
                  address using a privacy-preserving GeoIP lookup — the city-level location is logged but
                  the precise IP address is hashed and not retained in plaintext. Logins from previously
                  unseen locations or devices generate security notifications, enabling users to take
                  immediate action if an unfamiliar session is detected.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Infrastructure Security ── */}
      <section className="border-t border-white/[0.05] bg-gradient-to-b from-[#0c0a1e]/50 to-transparent" id="infrastructure">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Infrastructure Security</SectionLabel>
          <div className="mt-4 mb-12 max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug mb-5">
              Built on hardened infrastructure with multiple layers of network and system protection.
            </h2>
            <p className="text-[15px] text-white/50 leading-relaxed">
              Sendora operates on cloud infrastructure that incorporates enterprise-grade physical security,
              network isolation, DDoS mitigation, and automated vulnerability management. Our infrastructure
              is continuously monitored and subjected to regular security assessments.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {[
              {
                number: "01",
                title: "Cloudflare Network Protection",
                body: "All ingress traffic to Sendora's services passes through Cloudflare's global network, providing industry-leading DDoS mitigation, Web Application Firewall (WAF) protection, bot filtering, and IP reputation-based blocking. Cloudflare's Anycast network absorbs volumetric attacks at the network edge, preventing them from reaching Sendora's origin infrastructure.",
              },
              {
                number: "02",
                title: "Network Segmentation & Isolation",
                body: "Sendora's infrastructure components — web servers, application servers, database clusters, and caching layers — are deployed in logically and physically isolated network segments. Firewall rules enforce strict allow-list policies between segments, ensuring that a compromise of a front-end component cannot directly access sensitive back-end systems without traversing multiple security controls.",
              },
              {
                number: "03",
                title: "Database Access Controls",
                body: "Production database access is restricted to a minimal set of application service accounts operating under the principle of least privilege. No direct public internet access to database endpoints is permitted. Database credentials are rotated regularly, stored in encrypted secret management systems, and never embedded in application code or version control repositories.",
              },
              {
                number: "04",
                title: "Automated Patch Management",
                body: "Sendora's infrastructure is enrolled in automated security patching programmes that ensure operating system packages, runtime dependencies, and application libraries are updated promptly when security vulnerabilities are disclosed. Critical and high-severity patches are applied within 24 hours of vendor release; medium-severity patches are applied within the standard maintenance window.",
              },
              {
                number: "05",
                title: "Secure Software Supply Chain",
                body: "All third-party software dependencies introduced into the Sendora platform are reviewed for security posture, maintenance status, and licence compliance before adoption. Dependency manifests are locked to specific verified versions, and automated tooling monitors for newly disclosed vulnerabilities in the dependency tree, enabling rapid remediation.",
              },
              {
                number: "06",
                title: "Uptime & Redundancy",
                body: "Sendora's platform is architected for high availability, with redundant components at the web, application, and database tiers. Automated health monitoring detects and remedies service degradations before they impact users. Our infrastructure is designed to maintain 99.9% uptime, with planned maintenance windows communicated in advance.",
              },
            ].map(({ number, title, body }) => (
              <NumberCard key={number} number={number} title={title} body={body} />
            ))}
          </div>

          {/* Email-specific security */}
          <div className="rounded-3xl overflow-hidden border border-white/[0.08] bg-[#0d0b1e]/60">
            <div className="px-8 py-7 border-b border-white/[0.06]">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 mb-2">Email Infrastructure</p>
              <h3 className="text-[20px] font-extrabold text-white tracking-tight">Anti-Spoofing & Deliverability Standards</h3>
              <p className="text-[13.5px] text-white/45 leading-relaxed mt-2 max-w-2xl">
                Sendora implements the complete suite of email authentication standards to prevent domain spoofing
                and protect the integrity of emails sent from our platform.
              </p>
            </div>
            <div className="px-8 py-7 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  label: "SPF",
                  name: "Sender Policy Framework",
                  desc: "Publishes an authoritative list of IP addresses permitted to send email on behalf of sendora.me, allowing recipient servers to reject forged sender addresses.",
                },
                {
                  label: "DKIM",
                  name: "DomainKeys Identified Mail",
                  desc: "Cryptographically signs every outgoing email with a private key specific to the sending domain. Recipients can verify the signature using the public key published in our DNS record.",
                },
                {
                  label: "DMARC",
                  name: "Domain-based Message Authentication",
                  desc: "Instructs recipient mail servers how to handle emails that fail SPF or DKIM verification, enabling us to reject or quarantine unauthenticated messages claiming to be from Sendora.",
                },
                {
                  label: "MTA-STS",
                  name: "Mail Transfer Agent Strict Transport",
                  desc: "Enforces TLS encryption on all inbound SMTP connections to Sendora's mail servers, preventing downgrade attacks that would otherwise allow mail transport in plaintext.",
                },
              ].map(({ label, name, desc }) => (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] font-extrabold text-[#a78bff] font-mono">{label}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  </div>
                  <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-2">{name}</p>
                  <p className="text-[12.5px] text-white/42 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Privacy & Access Controls ── */}
      <section className="border-t border-white/[0.05]" id="privacy">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>User Privacy & Access Controls</SectionLabel>
          <div className="mt-4 mb-12 max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug mb-5">
              You control your data. We enforce that control at the architectural level.
            </h2>
            <p className="text-[15px] text-white/50 leading-relaxed">
              Privacy at Sendora is not a policy promise — it is enforced through the technical architecture
              of the platform. User data is structured, stored, and accessed in ways that place control
              firmly with the account holder, not with Sendora's operators.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-10">
            <div className="flex flex-col gap-4">
              {[
                {
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  ),
                  title: "No Internal Access to Email Content",
                  body: "Sendora engineers and support staff do not have routine access to the content of user emails. Access to production email data is technically restricted and requires an elevated access procedure with mandatory audit logging. We do not read, analyse, or act on the semantic content of your communications.",
                },
                {
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                      <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
                    </svg>
                  ),
                  title: "No Behavioural Profiling or Analytics",
                  body: "Sendora does not build behavioural profiles, engagement funnels, or advertising audiences from user activity. We collect only the operational telemetry required to maintain service health — and even that is anonymised and aggregated before analysis.",
                },
                {
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
                      <path d="m9 12 2 2 4-4"/>
                    </svg>
                  ),
                  title: "Zero Third-Party Data Sharing",
                  body: "Sendora does not sell, license, or share user data with third-party advertisers, data brokers, or analytics companies. The only third-party services with any access to user data are those strictly necessary for platform operation (e.g. our cloud infrastructure provider and our payment processor), and these relationships are governed by strict data processing agreements.",
                },
                {
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                      <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  ),
                  title: "Right to Erasure",
                  body: "Sendora honours your right to have your data permanently deleted. Account deletion triggers a cascading purge of all associated data — emails, session records, alias configurations, and payment history — from our production systems and backups within our stated retention window. This process is irreversible.",
                },
              ].map(({ icon, title, body }) => (
                <SecurityCard key={title} icon={icon} title={title} body={body} />
              ))}
            </div>

            <div className="flex flex-col gap-4">
              <div className="p-7 rounded-2xl bg-white/[0.025] border border-white/[0.07]">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 mb-5">Data We Collect</p>
                <div className="flex flex-col gap-3">
                  {[
                    { item: "Your chosen email address", purpose: "Account identification", retained: "For account lifetime" },
                    { item: "Argon2id password hash", purpose: "Authentication (cannot be reversed)", retained: "For account lifetime" },
                    { item: "Session tokens (hashed)", purpose: "Active session management", retained: "Until revocation or expiry" },
                    { item: "Login metadata (hashed IP, device, approx. location)", purpose: "Security auditing", retained: "90 days" },
                    { item: "Email content (encrypted at rest)", purpose: "Service delivery", retained: "Until deletion by user" },
                    { item: "Billing transaction records", purpose: "Payment processing & compliance", retained: "7 years (regulatory requirement)" },
                    { item: "Domain DNS configuration", purpose: "Custom domain routing", retained: "Until domain removed" },
                  ].map(({ item, purpose, retained }) => (
                    <div key={item} className="py-3 border-b border-white/[0.05] last:border-0">
                      <p className="text-[13px] font-semibold text-white mb-1">{item}</p>
                      <div className="flex flex-wrap gap-x-5 gap-y-0.5">
                        <p className="text-[11.5px] text-white/35"><span className="text-white/20">Purpose: </span>{purpose}</p>
                        <p className="text-[11.5px] text-white/35"><span className="text-white/20">Retained: </span>{retained}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-7 rounded-2xl bg-white/[0.025] border border-white/[0.07]">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 mb-5">Data We Never Collect</p>
                <div className="flex flex-col gap-2.5">
                  {[
                    "Plaintext passwords (ever)",
                    "Full IP addresses (retained in plaintext)",
                    "Phone numbers",
                    "Government-issued identity documents",
                    "Biometric data",
                    "Advertising identifiers or tracking pixels",
                    "Cross-site browsing behaviour",
                    "Third-party cookie data",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <div className="shrink-0 w-4 h-4 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5 text-red-400">
                          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"/>
                        </svg>
                      </div>
                      <span className="text-[12.5px] text-white/45">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Compliance ── */}
      <section className="border-t border-white/[0.05] bg-gradient-to-b from-[#0c0a1e]/50 to-transparent" id="compliance">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Compliance & Regulatory Framework</SectionLabel>
          <div className="mt-4 mb-12 max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug mb-5">
              Operating within — and frequently beyond — the requirements of applicable law.
            </h2>
            <p className="text-[15px] text-white/50 leading-relaxed">
              Sendora is committed to compliance with data protection legislation applicable to our operations
              and user base. We treat legal compliance as a floor — a minimum standard — rather than a ceiling.
              Our privacy and security practices routinely exceed what the law requires.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {[
              {
                flag: "🇮🇳",
                label: "India",
                law: "Information Technology Act, 2000 & DPDP Act, 2023",
                body: "Sendora is operated from India and complies fully with the Information Technology Act, 2000, the IT (Reasonable Security Practices) Rules, and the Digital Personal Data Protection Act, 2023. This includes maintaining reasonable security practices for the protection of sensitive personal data and honouring data principal rights as defined under the DPDP framework.",
              },
              {
                flag: "🇪🇺",
                label: "European Union",
                law: "GDPR — General Data Protection Regulation",
                body: "For users located in the European Economic Area, Sendora processes personal data in accordance with the principles of the GDPR — including lawfulness, fairness, transparency, purpose limitation, data minimisation, accuracy, and storage limitation. Users in the EEA may exercise rights of access, rectification, erasure, restriction, and portability by contacting support@sendora.me.",
              },
              {
                flag: "🌍",
                label: "International",
                law: "Privacy-first by default",
                body: "Regardless of the jurisdiction in which a user is located, Sendora applies its privacy-first data practices universally. We do not operate a tiered privacy model in which users in certain regions receive lesser protections than those in regulated markets. Every user benefits from the same foundational privacy and security architecture.",
              },
              {
                flag: "💳",
                label: "Payment Security",
                law: "PCI DSS (via Razorpay)",
                body: "Sendora does not directly process, store, or transmit payment card data. All payment handling is delegated to Razorpay, a PCI DSS Level 1 certified payment processor. Sendora receives only tokenised payment references, which cannot be used to reconstruct card numbers or bank account details.",
              },
              {
                flag: "📧",
                label: "Email Compliance",
                law: "CAN-SPAM, CASL, PECR",
                body: "Sendora's platform is designed to facilitate lawful email communication. Our terms of service prohibit the use of the platform for spam, unsolicited bulk email, or any communication that violates applicable anti-spam legislation including the US CAN-SPAM Act, Canada's CASL, and the UK's PECR. Violations may result in immediate account suspension.",
              },
              {
                flag: "⚖️",
                label: "Legal Requests",
                law: "Government & Law Enforcement",
                body: "Sendora will comply only with legal requests that are lawfully issued, properly scoped, and supported by appropriate judicial authority under applicable law. We will notify affected users of any legal demand to the maximum extent permitted, will challenge overbroad or legally deficient requests, and will publish a transparency report documenting the number and nature of requests received.",
              },
            ].map(({ flag, label, law, body }) => (
              <div key={label} className="p-7 rounded-2xl bg-white/[0.025] border border-white/[0.07] hover:border-[#6d4aff]/20 transition-colors flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-3xl leading-none">{flag}</span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25 mb-1">{label}</p>
                    <p className="text-[13px] font-bold text-white leading-snug">{law}</p>
                  </div>
                </div>
                <div className="h-px bg-white/[0.06]" />
                <p className="text-[12.5px] text-white/45 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Responsible Disclosure ── */}
      <section className="border-t border-white/[0.05]" id="disclosure">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Responsible Disclosure</SectionLabel>
          <div className="mt-4 grid lg:grid-cols-2 gap-14 items-start">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug mb-6">
                We take security reports seriously and reward responsible disclosure.
              </h2>
              <div className="flex flex-col gap-5 text-[15px] text-white/55 leading-[1.82]">
                <p>
                  Sendora operates a responsible disclosure programme for independent security researchers,
                  penetration testers, and members of the broader security community who identify potential
                  vulnerabilities in our platform, infrastructure, or associated services. We believe that
                  a collaborative relationship with the security research community is an essential component
                  of our overall security posture.
                </p>
                <p>
                  If you have identified a potential vulnerability, we ask that you report it to us privately
                  before public disclosure, giving our team a reasonable opportunity to investigate, reproduce,
                  and remediate the issue. We commit to acknowledging all valid security reports within one
                  business day, providing regular status updates during investigation, and notifying you when
                  the vulnerability has been remediated.
                </p>
                <p>
                  We will not pursue legal action against researchers who identify and disclose vulnerabilities
                  in good faith, in accordance with this policy. Researchers who provide us with clear,
                  concise, and actionable reports will receive our public acknowledgement (where desired)
                  and our genuine appreciation for their contribution to the safety of our users.
                </p>
              </div>
              <div className="mt-8">
                <a
                  href="mailto:support@sendora.me?subject=Security%20Disclosure"
                  className="inline-flex items-center gap-3 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#6d4aff] to-[#8b6aff] text-white font-semibold text-[14px] hover:from-[#7d5aff] hover:to-[#9b7aff] transition-all shadow-lg shadow-[#6d4aff]/25"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4.5 h-4.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Report a Vulnerability
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-5">
              <div className="p-7 rounded-2xl bg-white/[0.025] border border-white/[0.07]">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 mb-5">In-Scope Systems</p>
                <div className="flex flex-col gap-2.5">
                  {[
                    "sendora.me (primary web application)",
                    "api.sendora.me (API endpoints)",
                    "mail.sendora.me (mail server infrastructure)",
                    "Authentication and session management systems",
                    "User data access controls",
                    "Email delivery and routing pipeline",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <div className="shrink-0 w-4 h-4 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5 text-green-400">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd"/>
                        </svg>
                      </div>
                      <span className="text-[12.5px] text-white/50 font-mono">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-7 rounded-2xl bg-white/[0.025] border border-white/[0.07]">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 mb-5">Disclosure Guidelines</p>
                <div className="flex flex-col gap-4">
                  {[
                    { step: "1", text: "Email your report to support@sendora.me with subject: 'Security Disclosure'" },
                    { step: "2", text: "Include a clear description, proof-of-concept steps, and potential impact assessment" },
                    { step: "3", text: "Allow a minimum of 90 days for remediation before public disclosure" },
                    { step: "4", text: "Do not access, modify, or delete user data during your research" },
                  ].map(({ step, text }) => (
                    <div key={step} className="flex gap-4">
                      <div className="shrink-0 w-6 h-6 rounded-full bg-[#6d4aff]/20 border border-[#6d4aff]/30 flex items-center justify-center">
                        <span className="text-[11px] font-bold text-[#a78bff]">{step}</span>
                      </div>
                      <p className="text-[12.5px] text-white/48 leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Best Practices for Users ── */}
      <section className="border-t border-white/[0.05] bg-gradient-to-b from-[#0c0a1e]/50 to-transparent" id="best-practices">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionLabel>Security Best Practices</SectionLabel>
          <div className="mt-4 mb-12 max-w-3xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-snug mb-5">
              How to keep your Sendora account as secure as possible.
            </h2>
            <p className="text-[15px] text-white/50 leading-relaxed">
              While Sendora invests substantially in platform-level security, the security of an account
              is a shared responsibility. The following practices, when adopted consistently, will materially
              reduce the risk of account compromise.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {[
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                  </svg>
                ),
                title: "Enrol at Least One Passkey",
                body: "Passkeys are the strongest authentication method available on Sendora. Enrolling a passkey on your primary device eliminates the risk of your account being compromised through password theft or phishing. We strongly recommend this as your first action after creating an account.",
                badge: <PillBadge color="green">Highly Recommended</PillBadge>,
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                ),
                title: "Use a Strong, Unique Password",
                body: "If you authenticate with a password, ensure it is at least 16 characters in length, uses a combination of letters, numbers, and symbols, and is not reused from any other service. A password manager is the most reliable way to generate and store strong, unique credentials.",
                badge: <PillBadge color="violet">Required</PillBadge>,
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                ),
                title: "Review Active Sessions Regularly",
                body: "Check Settings → Security → Active Sessions periodically to confirm that all listed sessions correspond to devices and locations you recognise. If you identify an unfamiliar session, revoke it immediately and change your password.",
                badge: <PillBadge color="blue">Recommended</PillBadge>,
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                ),
                title: "Be Vigilant Against Phishing",
                body: "Sendora will never ask for your password via email. If you receive an email purporting to be from Sendora requesting your credentials or asking you to click a suspicious link, do not comply — report it to support@sendora.me. Always verify that the URL in your browser shows sendora.me before entering credentials.",
                badge: <PillBadge color="orange">Important</PillBadge>,
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                ),
                title: "Use Temporary Inbox for Untrusted Services",
                body: "When registering on websites or services you are unfamiliar with or do not fully trust, use Sendora's Temporary Inbox feature rather than your primary address. This prevents your real email address from appearing in data breaches or being used for spam.",
                badge: <PillBadge color="blue">Privacy Tip</PillBadge>,
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/>
                  </svg>
                ),
                title: "Log Out on Shared Devices",
                body: "If you access your Sendora account from a shared, public, or borrowed device, always log out explicitly when you have finished your session. Do not select 'Remember this device' on shared equipment. You may also terminate remote sessions from Settings → Security after using such a device.",
                badge: <PillBadge color="orange">Important</PillBadge>,
              },
            ].map(({ icon, title, body, badge }) => (
              <div key={title} className="p-6 rounded-2xl bg-white/[0.025] border border-white/[0.07] hover:border-[#6d4aff]/20 transition-colors flex flex-col gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#6d4aff]/12 text-[#a78bff] flex items-center justify-center">
                  {icon}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-start gap-2">
                    <h3 className="text-[14.5px] font-bold text-white leading-snug">{title}</h3>
                    {badge}
                  </div>
                  <p className="text-[12.5px] text-white/45 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Contact security */}
          <div className="p-8 rounded-3xl bg-gradient-to-r from-[#6d4aff]/10 to-[#0d0b1e] border border-[#6d4aff]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="text-[17px] font-bold text-white mb-2">Have a security concern?</p>
              <p className="text-[13.5px] text-white/50 leading-relaxed max-w-xl">
                If you suspect your account has been compromised, you have identified a security vulnerability,
                or you have a question about our security practices, please reach out to our team immediately.
                We treat all security communications with the highest priority.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                href="/contact"
                className="px-5 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white text-[13px] font-semibold hover:bg-white/[0.10] transition-colors text-center"
              >
                Contact Page
              </Link>
              <a
                href="mailto:support@sendora.me"
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#6d4aff] to-[#8b6aff] text-white text-[13px] font-semibold hover:from-[#7d5aff] hover:to-[#9b7aff] transition-all text-center shadow-lg shadow-[#6d4aff]/20"
              >
                Email Security Team
              </a>
            </div>
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
            <Link href="/contact" className="hover:text-white/60 transition-colors">Contact</Link>
            <Link href="/help" className="hover:text-white/60 transition-colors">Help</Link>
            <Link href="/privacy-policy" className="hover:text-white/60 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
            <Link href="/security" className="text-[#a78bff]">Security</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
