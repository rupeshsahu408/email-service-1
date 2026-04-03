import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Sendora",
  description:
    "Read Sendora's comprehensive Privacy Policy. We are committed to protecting your personal data, ensuring transparency, and respecting your rights.",
};

const EFFECTIVE_DATE = "April 1, 2026";
const LAST_UPDATED = "April 1, 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── Header ── */}
      <header className="bg-[#080710] border-b border-white/[0.06]">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img src="/sendora-logo.png" alt="Sendora" className="w-8 h-8 object-contain" />
            <span className="text-base font-semibold text-white tracking-tight">Sendora</span>
          </Link>
          <Link
            href="/"
            className="text-[13px] text-white/45 hover:text-white/85 transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      {/* ── Hero banner ── */}
      <div className="bg-gradient-to-br from-[#0d0b1e] via-[#110e2a] to-[#080710] py-16 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full bg-[#6d4aff]/15 border border-[#6d4aff]/25">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[#a78bff]">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
            </svg>
            <span className="text-[11px] font-semibold text-[#a78bff] uppercase tracking-wider">Legal Document</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-[15px] text-white/50 max-w-2xl leading-relaxed">
            At Sendora, privacy is not a feature — it is the foundation. This policy describes exactly
            what data we collect, why we collect it, how we protect it, and what rights you have over it.
          </p>
          <div className="mt-6 flex flex-wrap gap-6 text-[12px] text-white/35">
            <span><span className="text-white/55 font-medium">Effective date:</span> {EFFECTIVE_DATE}</span>
            <span><span className="text-white/55 font-medium">Last updated:</span> {LAST_UPDATED}</span>
            <span><span className="text-white/55 font-medium">Applies to:</span> sendora.me and all Sendora services</span>
          </div>
        </div>
      </div>

      {/* ── Table of Contents + Body ── */}
      <div className="mx-auto max-w-5xl w-full px-6 py-14 flex flex-col lg:flex-row gap-12">

        {/* Sidebar TOC */}
        <aside className="lg:w-64 shrink-0">
          <div className="sticky top-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9c94c2] mb-4">Contents</p>
            <nav className="flex flex-col gap-1">
              {[
                { n: "1", label: "Who We Are" },
                { n: "2", label: "Scope of This Policy" },
                { n: "3", label: "Information We Collect" },
                { n: "4", label: "How We Use Your Information" },
                { n: "5", label: "Legal Basis for Processing" },
                { n: "6", label: "Email Processing & Storage" },
                { n: "7", label: "AI-Powered Features" },
                { n: "8", label: "Cookies & Tracking" },
                { n: "9", label: "Third-Party Services" },
                { n: "10", label: "Data Sharing & Disclosure" },
                { n: "11", label: "Data Retention" },
                { n: "12", label: "Security" },
                { n: "13", label: "International Transfers" },
                { n: "14", label: "Your Rights" },
                { n: "15", label: "Children's Privacy" },
                { n: "16", label: "Business & Domain Users" },
                { n: "17", label: "Temporary Inbox" },
                { n: "18", label: "Changes to This Policy" },
                { n: "19", label: "Contact Us" },
              ].map(({ n, label }) => (
                <a
                  key={n}
                  href={`#section-${n}`}
                  className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg text-[13px] text-[#5a556e] hover:text-[#6d4aff] hover:bg-[#6d4aff]/6 transition-colors group"
                >
                  <span className="text-[10px] font-bold text-[#c4bfe0] group-hover:text-[#6d4aff] w-4 shrink-0">{n}</span>
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <article className="flex-1 min-w-0 prose-policy">

          {/* ─ Section 1 ─ */}
          <Section id="1" title="Who We Are">
            <p>
              Sendora (&ldquo;Sendora,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the website <strong>sendora.me</strong> and all associated
              sub-domains, mobile applications, application programming interfaces (APIs), and services
              (collectively, the &ldquo;Services&rdquo;). Sendora is a privacy-first email platform that enables users
              to send, receive, and manage electronic mail without the use of advertising, behavioural
              tracking, or data profiling.
            </p>
            <p>
              For the purposes of applicable data protection legislation — including, without limitation,
              the General Data Protection Regulation (EU) 2016/679 (&ldquo;GDPR&rdquo;), the UK GDPR, India's
              Information Technology Act 2000 and the Digital Personal Data Protection Act 2023 (&ldquo;DPDPA&rdquo;),
              and the California Consumer Privacy Act (&ldquo;CCPA&rdquo;) — Sendora is the <strong>data controller</strong>{" "}
              responsible for determining the purposes and means of processing your personal data.
            </p>
            <p>
              Our registered contact email is{" "}
              <a href="mailto:privacy@sendora.me" className="text-[#6d4aff] hover:underline">privacy@sendora.me</a>.
            </p>
          </Section>

          {/* ─ Section 2 ─ */}
          <Section id="2" title="Scope of This Policy">
            <p>
              This Privacy Policy applies to all individuals who:
            </p>
            <ul>
              <li>Visit or browse our website at sendora.me or any of its sub-domains;</li>
              <li>Register for and use a Sendora email account (personal or business);</li>
              <li>Use the Sendora Temporary Inbox feature;</li>
              <li>Send or receive email messages through our platform;</li>
              <li>Interact with our APIs, widgets, or integrations;</li>
              <li>Contact us for support, sales inquiries, or any other purpose;</li>
              <li>Subscribe to any communications from Sendora.</li>
            </ul>
            <p>
              This policy does <strong>not</strong> apply to third-party websites, services, or applications that may
              link to or from our Services. We encourage you to review the privacy policies of any
              third-party services you access through or in connection with Sendora.
            </p>
          </Section>

          {/* ─ Section 3 ─ */}
          <Section id="3" title="Information We Collect">
            <p>
              We collect information in three principal ways: information you provide to us directly,
              information collected automatically when you use our Services, and information received
              from third parties in the course of providing our Services.
            </p>

            <SubSection title="3.1 Information You Provide Directly">
              <TableBlock rows={[
                ["Account registration data", "Username, email address, password hash (we store a cryptographic hash — never a plain-text password), and optionally a display name or avatar image."],
                ["Passkey / WebAuthn credentials", "Public-key credential identifiers, authenticator attestation data, and device-bound key material used to authenticate you without a password. Private keys never leave your device."],
                ["Email messages", "The To, From, Cc, Bcc, Subject, message body, attachments, and associated metadata (timestamps, thread identifiers) of all messages you send and receive through our platform."],
                ["Draft content", "Automatically saved draft bodies, recipients, and attachments while you are composing a message."],
                ["Custom domain configuration", "Domain names, DNS verification records, and associated mailbox definitions submitted by Business plan users."],
                ["Support communications", "Content of messages, emails, or form submissions you send to our support team."],
                ["Payment information", "Subscription tier selection, billing cycle preference, and Razorpay-generated transaction identifiers. We do not store full card numbers, CVVs, or bank account details — all payment card processing is handled exclusively by Razorpay."],
                ["Profile and settings data", "Theme preference, compose font, notification settings, signature, and other account-level preferences."],
              ]} />
            </SubSection>

            <SubSection title="3.2 Information Collected Automatically">
              <TableBlock rows={[
                ["Log data", "IP address, browser type and version, operating system, referring URL, pages visited, time spent, and the date and time of each request."],
                ["Session tokens", "Cryptographically signed session identifiers stored as HTTP-only, Secure, SameSite cookies used solely for authentication. These are not used for advertising or tracking."],
                ["Device information", "General device type (desktop, tablet, mobile), viewport dimensions, and language preference — used to render the application correctly."],
                ["Approximate geolocation", "Country or region inferred from IP address using an offline GeoIP database (geoip-lite). We do not use GPS, cell tower, or Wi-Fi triangulation data. Precise location is never collected."],
                ["Usage events", "Actions performed within the application — such as opening a message, composing, or switching folders — collected to operate and improve the service. These events are not shared with advertising platforms."],
                ["Rate-limiting identifiers", "Hashed IP addresses retained briefly in our Upstash Redis cache solely to enforce rate limits and prevent abuse."],
              ]} />
            </SubSection>

            <SubSection title="3.3 Information Received from Third Parties">
              <p>
                When external senders deliver email to your Sendora address, we receive the message content,
                headers, and metadata from our email infrastructure provider (Resend) via inbound webhook.
                We do not solicit or acquire personal data about you from data brokers, advertising networks,
                or social media platforms.
              </p>
            </SubSection>
          </Section>

          {/* ─ Section 4 ─ */}
          <Section id="4" title="How We Use Your Information">
            <p>We use the information we collect for the following purposes:</p>
            <TableBlock rows={[
              ["Providing the Services", "Routing, storing, and displaying email messages; authenticating users; maintaining session state; providing compose, inbox, search, and labelling functionality."],
              ["Account management", "Creating and managing your account, processing plan upgrades or downgrades, managing billing, and communicating account-related notices (e.g., storage warnings, password resets)."],
              ["Security and fraud prevention", "Detecting and blocking spam, phishing, and malicious content; enforcing rate limits; preventing unauthorised access; monitoring for account takeover attempts; and reviewing suspicious activity."],
              ["Service improvement", "Analysing aggregated, anonymised usage patterns to prioritise features, diagnose performance issues, and improve reliability. Individual message content is never used for this purpose."],
              ["AI-assisted features", "Powering Smart Compose suggestions, email summarisation, and AI-assisted reply drafting when those features are enabled by you (see Section 7 for full detail)."],
              ["Customer support", "Responding to your inquiries, resolving disputes, and troubleshooting issues."],
              ["Legal compliance", "Meeting our obligations under applicable law, responding to lawful requests from public authorities, and enforcing our Terms of Service."],
              ["Transactional communications", "Sending account notifications, security alerts, billing receipts, and service announcements. We do not send unsolicited marketing emails."],
            ]} />
            <p>
              We will never use your email content to build advertising profiles, sell or license data
              to third parties for marketing purposes, or allow third-party advertising networks to
              access your information.
            </p>
          </Section>

          {/* ─ Section 5 ─ */}
          <Section id="5" title="Legal Basis for Processing (GDPR & UK GDPR)">
            <p>
              For users in the European Economic Area (EEA), the United Kingdom, and other jurisdictions
              that require a lawful basis for personal data processing, we rely on the following:
            </p>
            <TableBlock rows={[
              ["Performance of a contract (Art. 6(1)(b) GDPR)", "Processing necessary to create and maintain your account, deliver email services, process payments, and provide all core features you have signed up for."],
              ["Legitimate interests (Art. 6(1)(f) GDPR)", "Security monitoring, spam detection, fraud prevention, service analytics (on aggregated data), and improving platform reliability — where our interests do not override your fundamental rights."],
              ["Legal obligation (Art. 6(1)(c) GDPR)", "Compliance with applicable law, court orders, and regulatory requirements, including lawful requests from law enforcement."],
              ["Consent (Art. 6(1)(a) GDPR)", "Where we rely on consent (e.g., for optional AI features that process message content), you may withdraw it at any time without affecting the lawfulness of prior processing."],
            ]} />
          </Section>

          {/* ─ Section 6 ─ */}
          <Section id="6" title="Email Processing & Storage">
            <p>
              The core purpose of Sendora is to handle electronic mail on your behalf. This section
              explains precisely how we handle message content.
            </p>

            <SubSection title="6.1 Inbound Messages">
              <p>
                When a message is addressed to your Sendora inbox, our email infrastructure provider
                (Resend) receives the message, performs initial spam and malware filtering, and delivers
                it to our servers via a secure webhook. We parse, index, and store the full message —
                including headers, body, and attachments — in our database, associated with your account.
                Message content is stored in encrypted form at rest.
              </p>
            </SubSection>

            <SubSection title="6.2 Outbound Messages">
              <p>
                When you send a message, we pass it to Resend's outbound SMTP infrastructure for delivery.
                Resend may retain transactional log data (metadata such as recipient address, delivery
                status, and timestamps) in accordance with their own privacy policy. We store a copy
                of sent messages in your Sent folder.
              </p>
            </SubSection>

            <SubSection title="6.3 Anonymous Sending">
              <p>
                If you enable the &ldquo;Send Anonymously&rdquo; feature, your message is dispatched via a
                rotating alias address (e.g., <code>anon-xxxx@sendora.me</code>). Your real email address
                is not disclosed to the recipient. Replies are routed back to your inbox through this
                alias. We retain the alias-to-identity mapping internally to enable reply routing;
                this mapping is deleted when the alias expires or you delete your account.
              </p>
            </SubSection>

            <SubSection title="6.4 Scheduled & Queued Messages">
              <p>
                Messages you schedule for future delivery are stored securely in our jobs queue until
                the scheduled send time. You may cancel a scheduled message before it is dispatched.
                The five-second undo window that follows an immediate send is implemented via a brief
                pre-delivery hold; if you do not undo within that window, the message is dispatched
                and cannot be recalled.
              </p>
            </SubSection>

            <SubSection title="6.5 Confidential Messages">
              <p>
                When you send a message in Confidential Mode, the message body is stored with a
                defined expiry date. After that date, the message body is permanently deleted from
                our servers. Recipients view the message via a one-time access link; optional passcode
                protection may require the recipient to verify via email OTP before viewing. Expired
                confidential messages cannot be recovered.
              </p>
            </SubSection>

            <SubSection title="6.6 Attachments">
              <p>
                File attachments are uploaded to Cloudinary, our cloud media storage provider, via
                a secure server-side connection. We store the Cloudinary URL and metadata in our
                database linked to the relevant draft or message. Cloudinary applies its own security
                controls to stored files. Attachments associated with deleted messages are permanently
                removed from Cloudinary within 30 days of message deletion.
              </p>
            </SubSection>

            <SubSection title="6.7 Search Indexing">
              <p>
                We maintain a full-text index of your messages to power the in-app search feature.
                This index is stored on our own infrastructure, linked to your account, and is never
                shared with or accessible by third-party search providers or advertisers.
              </p>
            </SubSection>
          </Section>

          {/* ─ Section 7 ─ */}
          <Section id="7" title="AI-Powered Features">
            <p>
              Sendora offers optional AI-assisted features powered by Google Gemini (&ldquo;Gemini&rdquo;), including:
            </p>
            <ul>
              <li><strong>Smart Compose</strong> — inline suggestions as you type;</li>
              <li><strong>AI Write</strong> — drafting or rewriting email content based on your instructions;</li>
              <li><strong>Email Summarisation</strong> — condensing long messages into a brief summary;</li>
              <li><strong>Smart Reply Suggestions</strong> — proposing short reply options for received messages.</li>
            </ul>
            <p>
              When you invoke an AI feature, relevant portions of your email content (such as the
              message you are composing or reading) are transmitted to Google Gemini's API over an
              encrypted connection. Google processes this content to generate the AI output and returns
              the result to our servers, which display it in your compose window.
            </p>
            <p>
              <strong>Important:</strong> Google Gemini's use of data submitted through the API is governed by
              Google's API Terms of Service and Google Cloud Privacy Notice. As of the date of this policy,
              Google does not use API inputs to train its models by default. We recommend reviewing
              Google's current policies at{" "}
              <a href="https://cloud.google.com/terms/cloud-privacy-notice" target="_blank" rel="noopener noreferrer" className="text-[#6d4aff] hover:underline">
                cloud.google.com/terms/cloud-privacy-notice
              </a>.
            </p>
            <p>
              AI features are optional. Smart Compose can be disabled in Settings → Compose preferences.
              AI features that process message content are only invoked when you explicitly trigger
              them (e.g., clicking the &ldquo;AI&rdquo; button or accepting an inline suggestion). We do not
              automatically or in the background send your full inbox to any AI service.
            </p>
          </Section>

          {/* ─ Section 8 ─ */}
          <Section id="8" title="Cookies & Tracking Technologies">
            <SubSection title="8.1 Cookies We Use">
              <TableBlock rows={[
                ["Session cookie", "An HTTP-only, Secure, SameSite=Lax cookie containing a signed session token used to authenticate you. This cookie is strictly necessary for the application to function. It expires when you log out or after a rolling period of inactivity.", "Strictly necessary"],
                ["CSRF token", "A per-session token used to prevent cross-site request forgery attacks. Set as an HTTP-only cookie.", "Strictly necessary"],
                ["Turnstile challenge cookie", "Cloudflare Turnstile may set short-lived cookies as part of the bot-detection CAPTCHA challenge on signup and login forms. These are functional and privacy-preserving by design.", "Strictly necessary / Functional"],
                ["Theme preference", "A non-cookie mechanism (localStorage) may be used to remember your chosen colour theme. This stores only a string such as &ldquo;light&rdquo; or &ldquo;dark&rdquo; locally in your browser and is not transmitted to our servers.", "Functional"],
              ]} />
            </SubSection>

            <SubSection title="8.2 What We Do Not Use">
              <p>We do <strong>not</strong> use:</p>
              <ul>
                <li>Third-party advertising cookies or ad network trackers;</li>
                <li>Analytics cookies from Google Analytics, Meta Pixel, or similar platforms;</li>
                <li>Cross-site tracking or fingerprinting scripts;</li>
                <li>Persistent marketing cookies of any kind.</li>
              </ul>
            </SubSection>

            <SubSection title="8.3 Managing Cookies">
              <p>
                You can instruct your browser to refuse all cookies or to indicate when a cookie is
                being set. However, if you refuse strictly necessary cookies (such as the session cookie),
                you will not be able to log in to your Sendora account. Most browser manufacturers
                provide help pages relating to cookie management in their documentation.
              </p>
            </SubSection>
          </Section>

          {/* ─ Section 9 ─ */}
          <Section id="9" title="Third-Party Service Providers">
            <p>
              To operate our Services, we engage a limited number of carefully selected third-party
              processors. Each has been assessed against our data protection standards and is bound
              by contractual obligations (such as Data Processing Agreements) to process data only
              on our documented instructions and in accordance with applicable law.
            </p>
            <TableBlock rows={[
              ["Resend (resend.com)", "Email infrastructure — outbound SMTP delivery and inbound webhook processing. Resend processes message headers and content transiently during delivery.", "United States", "resend.com/legal/privacy-policy"],
              ["Cloudinary (cloudinary.com)", "Cloud media storage for file attachments and user avatars. Files are stored encrypted at rest.", "United States / EU", "cloudinary.com/privacy"],
              ["Razorpay (razorpay.com)", "Payment processing for Pro and Business plan subscriptions. Card data is processed entirely by Razorpay and never touches our servers.", "India", "razorpay.com/privacy"],
              ["Upstash (upstash.com)", "Redis-based rate limiting and caching. Stores only hashed identifiers (IP hashes, user IDs) for a brief period, never message content.", "United States / EU", "upstash.com/privacy"],
              ["Google Gemini API (cloud.google.com)", "AI content generation for optional Smart Compose, AI Write, and summarisation features. Invoked only on explicit user action.", "United States", "cloud.google.com/terms/cloud-privacy-notice"],
              ["Cloudflare Turnstile (cloudflare.com)", "Bot-detection CAPTCHA on signup and login forms. Privacy-preserving; no advertising profiling.", "Global", "cloudflare.com/privacypolicy/"],
            ]} />
            <p>
              We do not sell, rent, or otherwise transfer your data to any party for advertising,
              data brokerage, or commercial profiling purposes.
            </p>
          </Section>

          {/* ─ Section 10 ─ */}
          <Section id="10" title="Data Sharing & Disclosure">
            <p>
              We treat your data as confidential. We will share your personal data only in the
              following circumstances:
            </p>

            <SubSection title="10.1 Service Providers">
              <p>
                With the third-party processors listed in Section 9, strictly to the extent necessary
                to provide the Services and under enforceable confidentiality and data protection obligations.
              </p>
            </SubSection>

            <SubSection title="10.2 Legal Requirements">
              <p>
                We may disclose personal data where we believe in good faith that disclosure is necessary to:
              </p>
              <ul>
                <li>Comply with a legal obligation, applicable law, or binding regulation;</li>
                <li>Respond to a valid court order, subpoena, or warrant issued by a competent authority;</li>
                <li>Protect the rights, property, or safety of Sendora, our users, or the public;</li>
                <li>Detect, prevent, or address fraud, security vulnerabilities, or technical issues.</li>
              </ul>
              <p>
                Where permitted by law, we will notify you before disclosing your data in response to
                a legal demand, so that you may seek a protective order or other appropriate remedy.
              </p>
            </SubSection>

            <SubSection title="10.3 Business Transfers">
              <p>
                If Sendora undergoes a merger, acquisition, reorganisation, or sale of all or a portion
                of its assets, your personal data may be transferred as part of that transaction. We will
                provide notice via a prominent announcement on our website and, where required, obtain
                your consent before your data is transferred and becomes subject to a materially different
                privacy policy.
              </p>
            </SubSection>

            <SubSection title="10.4 With Your Consent">
              <p>
                We may share your data with additional third parties where you have given us explicit,
                informed consent to do so. You may withdraw such consent at any time.
              </p>
            </SubSection>

            <SubSection title="10.5 Aggregate & Anonymised Data">
              <p>
                We may share aggregated, anonymised statistical data (e.g., &ldquo;X% of users prefer dark
                mode&rdquo;) with partners, investors, or the public. Such data cannot be used to identify
                any individual user.
              </p>
            </SubSection>
          </Section>

          {/* ─ Section 11 ─ */}
          <Section id="11" title="Data Retention">
            <p>
              We retain personal data for as long as is necessary to fulfil the purposes described
              in this policy, to maintain your account, and to comply with our legal obligations.
              The following periods apply:
            </p>
            <TableBlock rows={[
              ["Account data (name, email address, password hash)", "For the lifetime of your account. Upon account deletion, this data is permanently purged within 30 days."],
              ["Email messages (inbox, sent, archived)", "For the lifetime of your account. Deleted messages are moved to Trash and permanently purged after 30 days, or immediately upon request."],
              ["Draft messages", "Retained until you send, discard, or delete the draft. Purged within 7 days of account deletion."],
              ["Attachments", "Retained alongside the associated message. Purged from Cloudinary within 30 days of message deletion."],
              ["Confidential messages", "Message body purged upon the user-defined expiry date. Metadata may be retained for up to 90 days for delivery audit purposes."],
              ["Session tokens", "Expire on logout or after 30 days of inactivity, whichever comes first."],
              ["Log & security data (IP addresses, request logs)", "Retained for a maximum of 90 days, used solely for security monitoring, rate limiting, and abuse prevention."],
              ["Rate-limiting cache data (Upstash Redis)", "Retained for the duration of the applicable rate-limit window — typically between 1 minute and 24 hours."],
              ["Payment & billing records", "Retained for 7 years to comply with financial and tax regulations."],
              ["Support communications", "Retained for 2 years after the closure of the support ticket, or until you request deletion, whichever is sooner."],
            ]} />
            <p>
              After the applicable retention period, data is securely and irreversibly deleted or anonymised.
            </p>
          </Section>

          {/* ─ Section 12 ─ */}
          <Section id="12" title="Security">
            <p>
              We implement a comprehensive set of technical and organisational measures to protect
              your personal data against unauthorised access, disclosure, alteration, or destruction.
              These include:
            </p>

            <SubSection title="12.1 Encryption">
              <ul>
                <li><strong>In transit:</strong> All data transmitted between your browser and our servers uses TLS 1.2 or TLS 1.3 with strong cipher suites. Email delivery to and from Resend uses encrypted SMTP (STARTTLS / TLS).</li>
                <li><strong>At rest:</strong> Databases, file storage (Cloudinary), and backups are encrypted using AES-256 or equivalent standards.</li>
                <li><strong>Passwords:</strong> We store only a cryptographic hash of your password using Argon2id, an industry-leading, memory-hard hashing algorithm. We can never retrieve your plain-text password.</li>
              </ul>
            </SubSection>

            <SubSection title="12.2 Authentication">
              <ul>
                <li>Support for <strong>Passkeys (WebAuthn / FIDO2)</strong> — phishing-resistant, device-bound authentication that eliminates reliance on passwords.</li>
                <li>Session token rotation on privilege escalation events.</li>
                <li>Automatic session invalidation after periods of inactivity.</li>
                <li>Account lockout and rate limiting on repeated failed login attempts.</li>
              </ul>
            </SubSection>

            <SubSection title="12.3 Infrastructure Security">
              <ul>
                <li>Access to production infrastructure is restricted to a minimal number of authorised personnel using multi-factor authentication.</li>
                <li>All changes to production systems are audited and logged.</li>
                <li>Automated vulnerability scanning and dependency auditing of our codebase.</li>
                <li>Spam and malware filtering on all inbound email.</li>
              </ul>
            </SubSection>

            <SubSection title="12.4 Incident Response">
              <p>
                In the event of a personal data breach that is likely to result in a risk to your rights
                and freedoms, we will notify the relevant supervisory authority within 72 hours of
                becoming aware of the breach (as required by GDPR Article 33) and, where required,
                notify affected users without undue delay.
              </p>
            </SubSection>

            <p>
              While we take every reasonable precaution to safeguard your data, no system is completely
              immune to security risks. We encourage you to use a strong, unique password or a Passkey,
              and to contact us immediately if you suspect unauthorised access to your account.
            </p>
          </Section>

          {/* ─ Section 13 ─ */}
          <Section id="13" title="International Data Transfers">
            <p>
              Sendora operates in India, and our primary data storage infrastructure is located there.
              However, because we use service providers whose infrastructure may be based in the
              United States or the European Union (see Section 9), your data may be transferred to
              and processed in countries outside your home jurisdiction.
            </p>
            <p>
              Where we transfer data to countries that do not provide an equivalent level of data
              protection to your home jurisdiction (for example, transfers from the EEA to the United
              States), we rely on one or more of the following safeguards:
            </p>
            <ul>
              <li>Standard Contractual Clauses (SCCs) approved by the European Commission;</li>
              <li>An adequacy decision by the European Commission in relation to the recipient country;</li>
              <li>Binding Corporate Rules where applicable;</li>
              <li>The UK International Data Transfer Agreement (IDTA) for UK GDPR transfers.</li>
            </ul>
            <p>
              You may request a copy of the relevant transfer mechanisms by contacting us at
              privacy@sendora.me.
            </p>
          </Section>

          {/* ─ Section 14 ─ */}
          <Section id="14" title="Your Privacy Rights">
            <p>
              Depending on your location, you may have the following rights with respect to your
              personal data. We will respond to all verified requests within the timeframes required
              by applicable law (typically 30 days, extendable by a further 30 days in complex cases).
            </p>

            <SubSection title="14.1 Rights Under GDPR / UK GDPR (EEA & UK Users)">
              <TableBlock rows={[
                ["Right of access (Art. 15)", "Obtain a copy of the personal data we hold about you, along with information about how it is processed."],
                ["Right to rectification (Art. 16)", "Request correction of inaccurate or incomplete personal data."],
                ["Right to erasure / 'right to be forgotten' (Art. 17)", "Request deletion of your personal data where there is no legitimate reason for us to continue processing it. You can delete your account at any time in Settings → Account → Delete Account."],
                ["Right to restriction of processing (Art. 18)", "Request that we temporarily suspend processing of your data while a dispute is resolved."],
                ["Right to data portability (Art. 20)", "Receive your personal data in a structured, commonly used, machine-readable format and transmit it to another controller. You can export your inbox data in standard formats from Settings → Export."],
                ["Right to object (Art. 21)", "Object to processing based on legitimate interests. We will cease such processing unless we can demonstrate compelling legitimate grounds that override your interests."],
                ["Right to withdraw consent (Art. 7(3))", "Withdraw consent at any time where processing is based on consent (e.g., AI features). Withdrawal does not affect the lawfulness of prior processing."],
                ["Right to lodge a complaint", "Lodge a complaint with your local supervisory authority. For EEA users, this is the data protection authority in your Member State. For UK users, this is the Information Commissioner's Office (ICO)."],
              ]} />
            </SubSection>

            <SubSection title="14.2 Rights Under the CCPA (California Users)">
              <p>
                If you are a California resident, the CCPA grants you the following additional rights:
              </p>
              <ul>
                <li><strong>Right to Know:</strong> Request disclosure of the categories and specific pieces of personal information we have collected about you, the categories of sources, the business purpose for collection, and the categories of third parties we share it with.</li>
                <li><strong>Right to Delete:</strong> Request deletion of personal information we have collected from you, subject to certain exceptions.</li>
                <li><strong>Right to Opt Out of Sale:</strong> We do <strong>not</strong> sell personal information as defined by the CCPA, and we have not done so in the preceding 12 months.</li>
                <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising any of your CCPA rights.</li>
                <li><strong>Right to Correct:</strong> Request correction of inaccurate personal information we hold about you.</li>
                <li><strong>Right to Limit Use of Sensitive Personal Information:</strong> We do not use sensitive personal information for purposes beyond providing our Services.</li>
              </ul>
              <p>
                To submit a CCPA request, please email{" "}
                <a href="mailto:privacy@sendora.me" className="text-[#6d4aff] hover:underline">privacy@sendora.me</a>{" "}
                with the subject line &ldquo;CCPA Rights Request.&rdquo; We will verify your identity before processing any request.
              </p>
            </SubSection>

            <SubSection title="14.3 Rights Under India's DPDPA (Indian Users)">
              <p>
                If you are located in India, you have the following rights under the Digital Personal
                Data Protection Act 2023:
              </p>
              <ul>
                <li><strong>Right to access information</strong> about the personal data we process about you;</li>
                <li><strong>Right to correction and erasure</strong> of your personal data;</li>
                <li><strong>Right to grievance redressal</strong> — you may lodge a complaint with our Grievance Officer at <a href="mailto:privacy@sendora.me" className="text-[#6d4aff] hover:underline">privacy@sendora.me</a>;</li>
                <li><strong>Right to nominate</strong> another individual to exercise these rights on your behalf in the event of your death or incapacity.</li>
              </ul>
            </SubSection>

            <SubSection title="14.4 How to Exercise Your Rights">
              <p>
                To exercise any of the rights described above, please contact us at{" "}
                <a href="mailto:privacy@sendora.me" className="text-[#6d4aff] hover:underline">privacy@sendora.me</a>{" "}
                or use the relevant in-app controls in your account Settings. We may ask you to verify
                your identity before fulfilling any request. We will not charge a fee for making a
                request unless it is manifestly unfounded or excessive.
              </p>
              <p>
                Many data rights can be exercised directly within your account:
              </p>
              <ul>
                <li><strong>Export your data:</strong> Settings → Account → Export</li>
                <li><strong>Delete your account:</strong> Settings → Account → Delete Account</li>
                <li><strong>Manage AI features:</strong> Settings → Compose</li>
                <li><strong>Change your password / passkeys:</strong> Settings → Security</li>
                <li><strong>Review active sessions:</strong> Settings → Security → Active Sessions</li>
              </ul>
            </SubSection>
          </Section>

          {/* ─ Section 15 ─ */}
          <Section id="15" title="Children's Privacy">
            <p>
              Our Services are not directed to, and we do not knowingly collect personal data from,
              individuals under the age of <strong>13</strong> (or, where applicable, such higher age as required
              by local law — for example, 16 in certain EEA Member States under GDPR recital 38).
            </p>
            <p>
              If you are a parent or guardian and you believe that your child has provided personal
              data to us without your consent, please contact us immediately at{" "}
              <a href="mailto:privacy@sendora.me" className="text-[#6d4aff] hover:underline">privacy@sendora.me</a>.
              We will take prompt steps to delete such data from our systems.
            </p>
          </Section>

          {/* ─ Section 16 ─ */}
          <Section id="16" title="Business & Domain Users">
            <p>
              If you are accessing Sendora as part of a business account or through a custom domain
              provisioned by your organisation (&ldquo;Organisation&rdquo;), the following applies:
            </p>
            <ul>
              <li>The Organisation that has contracted for the Business plan is the primary data controller for the email data associated with its custom domain. Sendora acts as a data processor on behalf of that Organisation for such data.</li>
              <li>The Organisation's administrators may have access to email account metadata (such as mailbox names and storage usage) for accounts under their domain. Administrators do not have access to the content of individual users' messages unless separately authorised and configured.</li>
              <li>This Privacy Policy governs Sendora's own data controller activities. Business users should also refer to any Data Processing Agreement (&ldquo;DPA&rdquo;) entered into between their Organisation and Sendora.</li>
              <li>If you are an individual user under an Organisation's Sendora account, please also review your Organisation's own privacy policy, as it may govern how they use data collected through Sendora.</li>
            </ul>
          </Section>

          {/* ─ Section 17 ─ */}
          <Section id="17" title="Temporary Inbox">
            <p>
              The Sendora Temporary Inbox is a disposable email feature that allows users to receive
              messages at a randomly generated, short-lived email address without creating a full
              Sendora account.
            </p>
            <ul>
              <li>Temporary addresses are valid for a defined time period (shown on screen) and are automatically deleted thereafter.</li>
              <li>Messages received at a temporary address are stored for the duration of the inbox&rsquo;s validity and are automatically purged on expiry.</li>
              <li>No account registration or personal data is required to use a Temporary Inbox. However, we log IP addresses and request data per our standard log retention policy (Section 11) for security and abuse prevention.</li>
              <li>Temporary inboxes are intended for legitimate, lawful use. We reserve the right to terminate any temporary address used for spam, fraud, or abuse without notice.</li>
              <li>Some features of the Temporary Inbox (such as retention extension or export) may require a Sendora account.</li>
            </ul>
          </Section>

          {/* ─ Section 18 ─ */}
          <Section id="18" title="Changes to This Privacy Policy">
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices,
              technology, legal requirements, or other factors. When we make material changes, we will:
            </p>
            <ul>
              <li>Post the revised policy on this page with an updated &ldquo;Last updated&rdquo; date at the top;</li>
              <li>Notify registered users via an in-app banner or notification and/or email to the address associated with your account, at least 14 days before the change takes effect (for material changes);</li>
              <li>Where required by applicable law, seek your consent before applying material changes.</li>
            </ul>
            <p>
              We encourage you to review this page periodically. Your continued use of the Services
              after the effective date of any change constitutes your acceptance of the updated policy,
              to the extent permitted by law. If you disagree with a change, you should stop using the
              Services and may request deletion of your account.
            </p>
            <p>
              Prior versions of this Privacy Policy are available upon request by emailing{" "}
              <a href="mailto:privacy@sendora.me" className="text-[#6d4aff] hover:underline">privacy@sendora.me</a>.
            </p>
          </Section>

          {/* ─ Section 19 ─ */}
          <Section id="19" title="Contact Us">
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or our
              data practices, please contact our Privacy Team:
            </p>
            <div className="bg-[#f8f6ff] border border-[#ede9fa] rounded-2xl p-6 mt-4 not-prose">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9c94c2] mb-2">General Privacy Enquiries</p>
                  <a href="mailto:privacy@sendora.me" className="text-[#6d4aff] font-medium text-sm hover:underline">privacy@sendora.me</a>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9c94c2] mb-2">Support & Account Issues</p>
                  <a href="mailto:support@sendora.me" className="text-[#6d4aff] font-medium text-sm hover:underline">support@sendora.me</a>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9c94c2] mb-2">Security Vulnerabilities</p>
                  <a href="mailto:security@sendora.me" className="text-[#6d4aff] font-medium text-sm hover:underline">security@sendora.me</a>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9c94c2] mb-2">Data Rights Requests</p>
                  <a href="mailto:privacy@sendora.me" className="text-[#6d4aff] font-medium text-sm hover:underline">privacy@sendora.me</a>
                  <p className="text-xs text-[#65637e] mt-1">Subject: &ldquo;Data Rights Request&rdquo;</p>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-[#ede9fa]">
                <p className="text-[13px] text-[#44425e]">
                  We aim to acknowledge all privacy-related enquiries within <strong>2 business days</strong> and to
                  resolve substantive requests within <strong>30 days</strong> (or as required by applicable law).
                  If you are unsatisfied with our response, you have the right to escalate your complaint
                  to the relevant supervisory authority in your jurisdiction.
                </p>
              </div>
            </div>
          </Section>

        </article>
      </div>

      {/* ── Footer ── */}
      <footer className="bg-[#080710] border-t border-white/[0.05] mt-auto">
        <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left">
            <p className="text-[12px] text-white/25">© {new Date().getFullYear()} Sendora. All rights reserved.</p>
            <span className="hidden sm:inline text-white/10">·</span>
            <p className="text-[12px] text-white/18">Privacy-first email, built with care.</p>
          </div>
          <div className="flex items-center gap-5 text-[12px]">
            <Link href="/" className="text-white/30 hover:text-white/65 transition-colors">Home</Link>
            <Link href="/privacy-policy" className="text-[#7c6aff] hover:text-[#a78bff] transition-colors font-medium">Privacy Policy</Link>
            <a href="mailto:support@sendora.me" className="text-white/30 hover:text-white/65 transition-colors">Contact</a>
          </div>
        </div>
      </footer>

    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={`section-${id}`} className="mb-14 scroll-mt-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#6d4aff]/10 text-[#6d4aff] text-[11px] font-bold shrink-0">
          {id}
        </span>
        <h2 className="text-[19px] font-bold text-[#1c1b33] tracking-tight">{title}</h2>
      </div>
      <div className="pl-10 flex flex-col gap-4 text-[14.5px] text-[#44425e] leading-[1.75]">
        {children}
      </div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 mb-1">
      <h3 className="text-[13.5px] font-semibold text-[#1c1b33] mb-3 tracking-tight">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function TableBlock({ rows }: { rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#ede9fa] my-2">
      <table className="w-full text-[13px] border-collapse">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#faf8ff]"}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-3 align-top text-[#44425e] border-b border-[#ede9fa] last:border-b-0 ${
                    j === 0 ? "font-semibold text-[#1c1b33] whitespace-nowrap w-[30%]" : ""
                  } ${row.length === 4 && j === 3 ? "text-[#6d4aff]" : ""}`}
                  dangerouslySetInnerHTML={{ __html: cell }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
