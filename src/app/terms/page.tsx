import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions — Sendora",
  description:
    "Read Sendora's Terms & Conditions. These terms govern your use of sendora.me and all associated Sendora services.",
};

const EFFECTIVE_DATE = "April 1, 2026";
const LAST_UPDATED = "April 1, 2026";

export default function TermsPage() {
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
              <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" clipRule="evenodd" />
            </svg>
            <span className="text-[11px] font-semibold text-[#a78bff] uppercase tracking-wider">Legal Document</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
            Terms &amp; Conditions
          </h1>
          <p className="text-[15px] text-white/50 max-w-2xl leading-relaxed">
            These Terms &amp; Conditions constitute a legally binding agreement between you and Sendora.
            Please read them carefully before using our services. By accessing or using Sendora, you agree to be bound by these terms.
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
                { n: "1",  label: "Acceptance of Terms" },
                { n: "2",  label: "Definitions" },
                { n: "3",  label: "Eligibility" },
                { n: "4",  label: "Account Registration & Security" },
                { n: "5",  label: "Subscription Plans & Billing" },
                { n: "6",  label: "Acceptable Use Policy" },
                { n: "7",  label: "Prohibited Activities" },
                { n: "8",  label: "User Content & Data" },
                { n: "9",  label: "Email Sending & Delivery" },
                { n: "10", label: "AI-Powered Features" },
                { n: "11", label: "Temporary Inbox Service" },
                { n: "12", label: "Anonymous Sending" },
                { n: "13", label: "Third-Party Integrations" },
                { n: "14", label: "Intellectual Property" },
                { n: "15", label: "Privacy & Data Protection" },
                { n: "16", label: "Service Availability & SLAs" },
                { n: "17", label: "Disclaimers of Warranties" },
                { n: "18", label: "Limitation of Liability" },
                { n: "19", label: "Indemnification" },
                { n: "20", label: "Account Suspension & Termination" },
                { n: "21", label: "Effect of Termination" },
                { n: "22", label: "Dispute Resolution" },
                { n: "23", label: "Governing Law & Jurisdiction" },
                { n: "24", label: "Changes to These Terms" },
                { n: "25", label: "Miscellaneous" },
                { n: "26", label: "Contact Information" },
              ].map(({ n, label }) => (
                <a
                  key={n}
                  href={`#section-${n}`}
                  className="flex items-start gap-2.5 py-1.5 px-2 rounded-lg text-[12.5px] text-[#7c74a8] hover:text-[#6d4aff] hover:bg-[#f5f3ff] transition-all duration-150 group"
                >
                  <span className="shrink-0 w-5 h-5 mt-[1px] rounded-md bg-[#f0edfc] text-[#9c94c2] group-hover:bg-[#6d4aff]/10 group-hover:text-[#6d4aff] flex items-center justify-center text-[10px] font-bold transition-all duration-150">
                    {n}
                  </span>
                  <span className="leading-snug">{label}</span>
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Body */}
        <main className="flex-1 min-w-0">
          <div className="flex flex-col gap-12 text-[14.5px] text-[#3d3659] leading-[1.78]">

            {/* ── 1. Acceptance of Terms ── */}
            <section id="section-1">
              <SectionHeading n="1" title="Acceptance of Terms" />
              <Prose>
                <p>
                  By accessing, downloading, installing, or using any part of the Sendora platform, website located at{" "}
                  <strong>sendora.me</strong>, mobile applications, browser extensions, application programming interfaces
                  (collectively, the "Services"), or by clicking "I agree," "Sign up," or any equivalent button, you
                  acknowledge that you have read, understood, and agree to be bound by these Terms &amp; Conditions
                  ("Terms"), our Privacy Policy (available at sendora.me/privacy-policy), and any other guidelines,
                  policies, or rules applicable to specific features of the Services, each of which is incorporated herein
                  by reference.
                </p>
                <p>
                  If you do not agree to these Terms in their entirety, you must immediately discontinue all use of the
                  Services. Your continued use of the Services following the posting of any modifications to these Terms
                  constitutes acceptance of those changes.
                </p>
                <p>
                  These Terms constitute the entire and exclusive agreement between you and Sendora with respect to your
                  use of the Services, and supersede and replace any prior agreements or representations between the
                  parties.
                </p>
              </Prose>
            </section>

            {/* ── 2. Definitions ── */}
            <section id="section-2">
              <SectionHeading n="2" title="Definitions" />
              <Prose>
                <p>For the purposes of these Terms, the following definitions apply:</p>
                <DefinitionList items={[
                  ["Sendora", "refers to the company operating the Services, its affiliates, officers, employees, agents, partners, and licensors."],
                  ["Services", "means the Sendora email platform, associated websites, APIs, desktop or mobile applications, browser extensions, and any other product or feature offered by Sendora, whether free or paid."],
                  ["Account", "means the unique registered account created by a user to access the Services."],
                  ["User / You", "refers to any individual or entity that accesses or uses the Services, including free-tier users, paid subscribers, and trial users."],
                  ["User Content", "means any data, messages, attachments, contacts, signatures, configurations, or other materials submitted, uploaded, sent, or received through the Services."],
                  ["Subscription Plan", "refers to a paid or free-tier access tier selected by the user, which determines the features, limits, and pricing applicable to their use of the Services."],
                  ["Personal Data", "means any information relating to an identified or identifiable natural person, as defined under applicable data protection laws."],
                  ["Temporary Inbox", "refers to the disposable email inbox feature that provides a short-lived email address for a limited time period."],
                  ["Anonymous Sending", "refers to the feature that allows users to send emails without disclosing their primary Sendora email address."],
                  ["Third-Party Services", "means any software, platform, or service provided by a party other than Sendora that may be integrated with or accessed through the Services."],
                ]} />
              </Prose>
            </section>

            {/* ── 3. Eligibility ── */}
            <section id="section-3">
              <SectionHeading n="3" title="Eligibility" />
              <Prose>
                <p>
                  To use the Services, you must be at least <strong>13 years of age</strong>. If you are between the ages
                  of 13 and 18 (or the applicable age of majority in your jurisdiction), you represent and warrant that
                  your parent or legal guardian has reviewed and agreed to these Terms on your behalf.
                </p>
                <p>
                  By creating an Account, you represent and warrant that:
                </p>
                <ul>
                  <li>you are of legal age to form a binding contract with Sendora in your jurisdiction;</li>
                  <li>you are not prohibited from using the Services under any applicable law;</li>
                  <li>you have not previously been suspended or removed from the Services for a violation of these Terms;</li>
                  <li>you will comply with all applicable local, national, and international laws, regulations, and ordinances in connection with your use of the Services;</li>
                  <li>all registration information you provide is accurate, current, and complete.</li>
                </ul>
                <p>
                  Sendora reserves the right, in its sole discretion, to refuse registration, suspend, or terminate any
                  Account at any time if we reasonably believe the eligibility requirements are not met.
                </p>
              </Prose>
            </section>

            {/* ── 4. Account Registration & Security ── */}
            <section id="section-4">
              <SectionHeading n="4" title="Account Registration & Security" />
              <Prose>
                <p>
                  To access most features of the Services, you must create an Account by providing a username (local part),
                  a secure password, and, where applicable, a backup recovery key. You agree to provide accurate and
                  complete information during the registration process and to update such information promptly if it changes.
                </p>
                <p>
                  You are solely responsible for:
                </p>
                <ul>
                  <li>maintaining the confidentiality of your account credentials, including your password, recovery key, and any passkeys registered to your account;</li>
                  <li>all activities that occur under your Account, whether or not authorised by you;</li>
                  <li>immediately notifying Sendora at <strong>support@sendora.me</strong> upon becoming aware of any unauthorised use of your Account or any other breach of security.</li>
                </ul>
                <p>
                  Sendora implements industry-standard security measures including Argon2id password hashing and
                  hardware-backed passkey authentication (WebAuthn/FIDO2). However, no system is entirely immune to
                  security risks, and Sendora cannot guarantee that unauthorised third parties will never be able to
                  defeat our security measures.
                </p>
                <p>
                  You agree not to share your Account with any other person or entity. Accounts are personal and
                  non-transferable unless explicitly permitted under a Business or Enterprise subscription plan.
                  Any Account found to be shared in violation of this restriction may be suspended without notice.
                </p>
                <p>
                  Sendora will never ask you for your password or recovery key via email, chat, or any channel other
                  than the official account recovery flow within the Services.
                </p>
              </Prose>
            </section>

            {/* ── 5. Subscription Plans & Billing ── */}
            <section id="section-5">
              <SectionHeading n="5" title="Subscription Plans & Billing" />
              <Prose>
                <p>
                  Sendora offers both free-tier and paid Subscription Plans. The features, storage limits, and usage
                  quotas applicable to each plan are described on the Sendora pricing page and are subject to change
                  with reasonable notice.
                </p>
                <Callout color="purple">
                  <strong>Billing is processed through Razorpay.</strong> By subscribing to a paid plan, you authorise
                  Sendora and its payment processor to charge your designated payment method on a recurring basis at the
                  applicable subscription frequency.
                </Callout>
                <p>
                  You agree that:
                </p>
                <ul>
                  <li><strong>Recurring charges.</strong> Paid subscriptions renew automatically at the end of each billing period (monthly or annually, as selected) unless you cancel before the renewal date.</li>
                  <li><strong>Pricing changes.</strong> Sendora reserves the right to change subscription prices. We will provide at least thirty (30) days' notice before any price change takes effect for existing subscribers. Continued use of the Services after the price change becomes effective constitutes acceptance of the new price.</li>
                  <li><strong>No refunds.</strong> Except as required by applicable law or expressly stated in a promotional offer, all fees are non-refundable. If you cancel a paid subscription, you will retain access to paid features until the end of the current billing period, after which your account will revert to the free tier.</li>
                  <li><strong>Taxes.</strong> Prices displayed are exclusive of applicable taxes, including Goods and Services Tax (GST) in India, unless expressly stated otherwise. You are responsible for all applicable taxes associated with your subscription.</li>
                  <li><strong>Failed payments.</strong> If a payment fails, Sendora may suspend access to paid features until payment is received. Sendora may retry failed payments at its discretion.</li>
                  <li><strong>Free trials.</strong> If Sendora offers a free trial for a paid plan, your payment method may be charged at the end of the trial period unless you cancel before the trial ends.</li>
                </ul>
                <p>
                  Disputes relating to billing must be raised within ninety (90) days of the charge by contacting
                  <strong> support@sendora.me</strong>. Sendora is not responsible for billing disputes raised after
                  this period.
                </p>
              </Prose>
            </section>

            {/* ── 6. Acceptable Use Policy ── */}
            <section id="section-6">
              <SectionHeading n="6" title="Acceptable Use Policy" />
              <Prose>
                <p>
                  The Services are intended for lawful personal and business communication. You agree to use the Services
                  solely for legitimate purposes and in a manner that does not infringe the rights of others or restrict
                  or inhibit anyone else's use or enjoyment of the Services.
                </p>
                <p>
                  You are solely responsible for all User Content that you send, receive, store, or otherwise process
                  through the Services. You represent and warrant that:
                </p>
                <ul>
                  <li>all User Content complies with all applicable laws, regulations, and third-party rights;</li>
                  <li>you have all necessary rights, licences, consents, and permissions to use and submit your User Content;</li>
                  <li>your use of the Services will not violate any contractual obligations you have to any third party;</li>
                  <li>your User Content does not contain viruses, malware, spyware, or any other harmful code.</li>
                </ul>
                <p>
                  The following usage limits apply per account on the free tier, unless modified by a paid Subscription
                  Plan:
                </p>
                <ul>
                  <li>Daily outbound email sending limits as specified on the pricing page;</li>
                  <li>Attachment size limits per email as specified in the Services;</li>
                  <li>Storage quotas for received email as specified in the Services.</li>
                </ul>
                <p>
                  Sendora reserves the right to impose additional usage limits at any time to protect the reliability
                  of the Services for all users.
                </p>
              </Prose>
            </section>

            {/* ── 7. Prohibited Activities ── */}
            <section id="section-7">
              <SectionHeading n="7" title="Prohibited Activities" />
              <Prose>
                <p>
                  You expressly agree not to use the Services to engage in, facilitate, or promote any of the
                  following activities:
                </p>
                <ul>
                  <li><strong>Spam &amp; unsolicited mail.</strong> Sending bulk, unsolicited, or commercial email messages ("spam") to recipients who have not opted in to receive communications from you, in violation of the CAN-SPAM Act, CASL, GDPR, or any other applicable anti-spam legislation.</li>
                  <li><strong>Phishing &amp; fraud.</strong> Sending deceptive, fraudulent, or misleading emails; impersonating any individual, organisation, or domain; conducting phishing attacks, social engineering, or identity theft schemes.</li>
                  <li><strong>Malware distribution.</strong> Sending or facilitating the transmission of viruses, worms, Trojan horses, ransomware, spyware, adware, or any other form of malicious code or software designed to damage, disrupt, or gain unauthorised access to computer systems.</li>
                  <li><strong>Illegal content.</strong> Transmitting, storing, or distributing any content that is unlawful, defamatory, obscene, pornographic, involves child exploitation or abuse material (CSAM), promotes violence, terrorism, or discrimination based on race, ethnicity, religion, gender, sexual orientation, or disability.</li>
                  <li><strong>Harassment &amp; abuse.</strong> Using the Services to harass, threaten, intimidate, or abuse any individual or group, including Sendora employees and agents.</li>
                  <li><strong>Intellectual property infringement.</strong> Sending or storing content that infringes upon any patent, trademark, trade secret, copyright, right of publicity, or other intellectual property right of any party.</li>
                  <li><strong>Unauthorised access.</strong> Attempting to gain unauthorised access to the Services, Sendora's systems or networks, or any other user's Account, including through brute-force attacks, credential stuffing, or exploitation of vulnerabilities.</li>
                  <li><strong>Reverse engineering.</strong> Decompiling, disassembling, reverse-engineering, or otherwise attempting to derive the source code, algorithms, or underlying structure of the Services.</li>
                  <li><strong>Automated abuse.</strong> Using bots, scrapers, automated scripts, or any other automated means to access, crawl, or interact with the Services in a manner that places excessive load on our infrastructure or circumvents rate limits.</li>
                  <li><strong>Resale without authorisation.</strong> Reselling, sublicensing, or otherwise providing access to the Services to third parties without Sendora's prior written consent.</li>
                  <li><strong>Sanctions evasion.</strong> Using the Services in violation of any export control, trade sanction, or embargo law imposed by the Government of India, the United States, the European Union, or any other applicable authority.</li>
                  <li><strong>Market manipulation.</strong> Sending fraudulent financial solicitations, pump-and-dump schemes, or any communication designed to manipulate securities or cryptocurrency markets.</li>
                </ul>
                <p>
                  Violation of this Acceptable Use Policy may result in immediate suspension or termination of your Account,
                  referral to law enforcement authorities, and civil or criminal liability. Sendora reserves the right to
                  investigate any suspected violations and to cooperate with regulatory and law enforcement agencies.
                </p>
              </Prose>
            </section>

            {/* ── 8. User Content & Data ── */}
            <section id="section-8">
              <SectionHeading n="8" title="User Content & Data" />
              <Prose>
                <p>
                  You retain all ownership rights to your User Content. By using the Services, you grant Sendora a
                  limited, non-exclusive, royalty-free, worldwide licence to process, transmit, store, and display
                  your User Content solely to the extent necessary to provide and improve the Services, as described
                  in our Privacy Policy.
                </p>
                <p>
                  Sendora does not sell, rent, or share your email content or contact data with third parties for
                  advertising, marketing, or profiling purposes. Sendora does not scan the content of your emails
                  to serve targeted advertisements.
                </p>
                <p>
                  You acknowledge and agree that:
                </p>
                <ul>
                  <li>Sendora may access your User Content to the extent necessary to investigate security incidents, respond to legal process, enforce these Terms, or provide technical support with your explicit consent;</li>
                  <li>automated systems (including AI and spam-detection systems) may process your User Content as part of the delivery, filtering, and feature operation processes;</li>
                  <li>you are responsible for maintaining independent backups of any important data, as Sendora does not guarantee permanent retention of User Content;</li>
                  <li>Sendora may impose storage limits and may delete User Content that exceeds these limits after providing reasonable notice where practicable.</li>
                </ul>
                <p>
                  If you believe that content stored in your Account belongs to you, you may export it at any time
                  using the data export tools available within the Services, or by contacting{" "}
                  <strong>support@sendora.me</strong>.
                </p>
              </Prose>
            </section>

            {/* ── 9. Email Sending & Delivery ── */}
            <section id="section-9">
              <SectionHeading n="9" title="Email Sending & Delivery" />
              <Prose>
                <p>
                  Sendora uses third-party transactional email infrastructure (including Resend) to deliver outbound
                  emails sent through the Services. You acknowledge that:
                </p>
                <ul>
                  <li>Sendora does not guarantee delivery of any email message. Email delivery depends on factors outside Sendora's control, including recipient mail servers, spam filters, DNS configurations, and network conditions.</li>
                  <li>Sendora maintains sending reputation policies. Any use of the Services that damages Sendora's IP or domain reputation may result in immediate account suspension without prior notice.</li>
                  <li>Emails sent through the Services are subject to daily and monthly sending limits as defined by your Subscription Plan. Exceeding these limits may result in temporary sending restrictions.</li>
                  <li>Sendora reserves the right to place emails on hold, quarantine, or refuse to deliver any message that it reasonably determines to violate these Terms or applicable laws.</li>
                  <li>Scheduled emails are delivered on a best-effort basis. Sendora does not guarantee exact-time delivery for scheduled messages.</li>
                </ul>
                <p>
                  You are responsible for ensuring that your use of the Services complies with all applicable email
                  marketing and anti-spam laws, including providing valid unsubscribe mechanisms in commercial emails
                  where required by law.
                </p>
              </Prose>
            </section>

            {/* ── 10. AI-Powered Features ── */}
            <section id="section-10">
              <SectionHeading n="10" title="AI-Powered Features" />
              <Prose>
                <p>
                  Sendora may offer AI-powered features including but not limited to email composition assistance,
                  summarisation, smart replies, translation, and content suggestions (collectively, "AI Features").
                  These features are powered by third-party large language model providers, including Google Gemini.
                </p>
                <p>
                  With respect to AI Features, you agree and acknowledge that:
                </p>
                <ul>
                  <li><strong>Not professional advice.</strong> AI-generated content is not legal, financial, medical, or professional advice. You should not rely on AI outputs for decisions of consequence without independent verification from qualified professionals.</li>
                  <li><strong>Inaccuracies.</strong> AI systems may produce inaccurate, incomplete, biassed, or factually incorrect output. Sendora makes no warranties regarding the accuracy, reliability, or fitness for purpose of AI-generated content.</li>
                  <li><strong>Data processing.</strong> When you use AI Features, excerpts of your email content or context may be transmitted to third-party AI model providers under their respective data processing terms. Sendora takes reasonable steps to minimise data exposure, but you should not input highly sensitive or confidential information into AI Feature prompts.</li>
                  <li><strong>Output ownership.</strong> You retain ownership of content generated by AI Features at your request, subject to the terms of the underlying model provider.</li>
                  <li><strong>Prohibited uses.</strong> You may not use AI Features to generate spam, phishing content, disinformation, or any content that violates these Terms or applicable laws.</li>
                </ul>
                <p>
                  Sendora may modify, restrict, or discontinue AI Features at any time without liability. AI Features
                  may be subject to separate terms published by the underlying model providers, and your use of such
                  features constitutes acceptance of those terms.
                </p>
              </Prose>
            </section>

            {/* ── 11. Temporary Inbox Service ── */}
            <section id="section-11">
              <SectionHeading n="11" title="Temporary Inbox Service" />
              <Prose>
                <p>
                  Sendora provides a Temporary Inbox feature that issues disposable email addresses that expire after
                  a user-defined period. The following conditions apply specifically to this feature:
                </p>
                <ul>
                  <li>Temporary Inbox addresses are issued for legitimate privacy use cases such as account registration on third-party services, receiving one-time passwords (OTPs), and avoiding unsolicited marketing.</li>
                  <li>All emails received to a Temporary Inbox address are automatically deleted upon expiry of the alias. Sendora is not responsible for any messages lost as a result of alias expiry.</li>
                  <li>You must not use Temporary Inbox addresses to impersonate organisations, engage in fraud, circumvent account verification for illegal purposes, or violate the terms of any third-party service.</li>
                  <li>Temporary Inbox email history is not guaranteed to be retained after alias expiry. Sendora may purge expired alias data at any time.</li>
                  <li>Access to extended Temporary Inbox features (longer expiry periods, multiple concurrent aliases) may require a paid Subscription Plan.</li>
                </ul>
              </Prose>
            </section>

            {/* ── 12. Anonymous Sending ── */}
            <section id="section-12">
              <SectionHeading n="12" title="Anonymous Sending" />
              <Prose>
                <p>
                  Sendora provides an Anonymous Sending feature that allows users to send emails without revealing
                  their primary Sendora email address. A unique routing alias is generated for each anonymous send,
                  enabling reply routing without disclosing the sender's identity.
                </p>
                <Callout color="amber">
                  <strong>Important:</strong> Anonymous Sending is provided as a privacy tool for legitimate use.
                  It must not be used for harassment, threats, fraud, spam, phishing, impersonation, or any other
                  unlawful purpose. Sendora reserves the right to disclose sender identity information to law
                  enforcement in response to valid legal process, notwithstanding the Anonymous Sending feature.
                </Callout>
                <p>
                  You agree that:
                </p>
                <ul>
                  <li>Anonymous Sending does not provide absolute anonymity. Sendora retains internal records associating anonymous alias addresses with user accounts for abuse prevention and legal compliance purposes.</li>
                  <li>Misuse of the Anonymous Sending feature constitutes a material breach of these Terms and may result in immediate account termination and referral to law enforcement.</li>
                  <li>You remain legally responsible for all emails sent using the Anonymous Sending feature, regardless of the alias displayed to recipients.</li>
                </ul>
              </Prose>
            </section>

            {/* ── 13. Third-Party Integrations ── */}
            <section id="section-13">
              <SectionHeading n="13" title="Third-Party Integrations" />
              <Prose>
                <p>
                  The Services may integrate with or link to third-party services, platforms, and APIs, including but
                  not limited to Resend (email delivery), Cloudinary (attachment storage), Razorpay (payment processing),
                  Upstash Redis (rate limiting and caching), Google Gemini (AI features), and Cloudflare (infrastructure
                  and DDoS protection).
                </p>
                <p>
                  Your use of any third-party service is governed solely by that service's own terms and privacy policy.
                  Sendora is not responsible for the acts or omissions of third-party providers, including any downtime,
                  data breach, or service failure on their part. Sendora does not endorse any third-party service and
                  makes no representations or warranties regarding their reliability, security, or fitness for purpose.
                </p>
                <p>
                  If you connect a custom domain or external mailbox to the Services, you are responsible for ensuring
                  that such connections comply with the terms of the respective domain registrar, DNS provider, and
                  any applicable hosting service.
                </p>
              </Prose>
            </section>

            {/* ── 14. Intellectual Property ── */}
            <section id="section-14">
              <SectionHeading n="14" title="Intellectual Property" />
              <Prose>
                <p>
                  All rights, title, and interest in and to the Services — including all software, code, interfaces,
                  designs, graphics, text, logos, trade names (including "Sendora"), trade dress, databases, algorithms,
                  and other intellectual property — are and shall remain the exclusive property of Sendora and its
                  licensors. These Terms do not transfer or assign to you any intellectual property rights in the Services.
                </p>
                <p>
                  Subject to your full compliance with these Terms, Sendora grants you a limited, personal,
                  non-exclusive, non-transferable, non-sublicensable, revocable licence to access and use the Services
                  solely for your own lawful purposes. This licence does not include the right to:
                </p>
                <ul>
                  <li>copy, reproduce, distribute, transmit, display, perform, publish, or create derivative works of the Services or any part thereof;</li>
                  <li>reverse engineer, decompile, disassemble, or attempt to derive the source code of any portion of the Services;</li>
                  <li>remove or alter any proprietary notices, labels, or marks on the Services;</li>
                  <li>use the Sendora name, logo, or branding in any manner that implies endorsement or affiliation without prior written consent.</li>
                </ul>
                <p>
                  Any feedback, suggestions, or ideas you provide to Sendora regarding the Services ("Feedback") may
                  be used by Sendora freely and without compensation or obligation to you. You hereby assign to Sendora
                  all rights in any Feedback you provide.
                </p>
              </Prose>
            </section>

            {/* ── 15. Privacy & Data Protection ── */}
            <section id="section-15">
              <SectionHeading n="15" title="Privacy & Data Protection" />
              <Prose>
                <p>
                  Your use of the Services is subject to Sendora's Privacy Policy, available at{" "}
                  <Link href="/privacy-policy" className="text-[#6d4aff] hover:underline font-medium">
                    sendora.me/privacy-policy
                  </Link>
                  , which is incorporated into these Terms by reference. By using the Services, you consent to
                  the collection, processing, and use of your Personal Data as described in the Privacy Policy.
                </p>
                <p>
                  If you are using the Services on behalf of an organisation in a jurisdiction subject to GDPR, UK GDPR,
                  CCPA, India's DPDPA, or other data protection regulations, you warrant that you have obtained all
                  necessary consents and legal bases for processing the Personal Data of any third parties (including
                  email recipients) whose data you submit to the Services.
                </p>
                <p>
                  Sendora acts as a data processor in respect of Personal Data contained within your email communications,
                  and as a data controller in respect of your account and usage data. Where required by applicable law,
                  Sendora is prepared to enter into a Data Processing Agreement (DPA) with eligible business customers.
                  Please contact <strong>support@sendora.me</strong> to request a DPA.
                </p>
              </Prose>
            </section>

            {/* ── 16. Service Availability & SLAs ── */}
            <section id="section-16">
              <SectionHeading n="16" title="Service Availability & SLAs" />
              <Prose>
                <p>
                  Sendora strives to maintain high availability of the Services but does not guarantee uninterrupted,
                  error-free, or perpetually available service. Sendora may experience downtime due to:
                </p>
                <ul>
                  <li>scheduled maintenance (which Sendora will endeavour to announce in advance where possible);</li>
                  <li>unplanned outages, infrastructure failures, or force majeure events;</li>
                  <li>third-party provider disruptions (including email delivery providers, cloud infrastructure, or payment processors);</li>
                  <li>actions taken to investigate or mitigate security threats or abuse.</li>
                </ul>
                <p>
                  Business plan subscribers may be entitled to service level commitments as specified in their
                  Subscription Plan documentation. For all other users, Sendora does not offer contractual uptime
                  guarantees. Sendora's liability for service unavailability is limited as set forth in the
                  Limitation of Liability section below.
                </p>
              </Prose>
            </section>

            {/* ── 17. Disclaimers of Warranties ── */}
            <section id="section-17">
              <SectionHeading n="17" title="Disclaimers of Warranties" />
              <Prose>
                <Callout color="slate">
                  The following section contains important limitations on Sendora's legal obligations. Please read carefully.
                </Callout>
                <p>
                  TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICES ARE PROVIDED ON AN <strong>"AS IS"</strong> AND{" "}
                  <strong>"AS AVAILABLE"</strong> BASIS, WITHOUT ANY WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. SENDORA
                  EXPRESSLY DISCLAIMS ALL WARRANTIES, INCLUDING WITHOUT LIMITATION:
                </p>
                <ul>
                  <li>IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT;</li>
                  <li>WARRANTIES THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS;</li>
                  <li>WARRANTIES REGARDING THE ACCURACY, RELIABILITY, COMPLETENESS, OR TIMELINESS OF ANY CONTENT, DATA, OR INFORMATION AVAILABLE THROUGH THE SERVICES;</li>
                  <li>WARRANTIES THAT EMAILS SENT THROUGH THE SERVICES WILL BE DELIVERED, RECEIVED, OR READ BY INTENDED RECIPIENTS.</li>
                </ul>
                <p>
                  SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OF CERTAIN WARRANTIES. TO THE EXTENT SUCH EXCLUSIONS
                  ARE NOT PERMITTED, SENDORA'S WARRANTIES ARE LIMITED IN DURATION TO THIRTY (30) DAYS FROM THE DATE
                  YOU FIRST ACCESS THE APPLICABLE FEATURE OF THE SERVICES.
                </p>
              </Prose>
            </section>

            {/* ── 18. Limitation of Liability ── */}
            <section id="section-18">
              <SectionHeading n="18" title="Limitation of Liability" />
              <Prose>
                <p>
                  TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL SENDORA, ITS AFFILIATES,
                  OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, PARTNERS, SUPPLIERS, OR LICENSORS BE LIABLE FOR:
                </p>
                <ul>
                  <li>ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, LOSS OF REVENUE, LOSS OF DATA, LOSS OF GOODWILL, BUSINESS INTERRUPTION, OR COST OF SUBSTITUTE SERVICES;</li>
                  <li>DAMAGES ARISING OUT OF OR RELATED TO UNAUTHORISED ACCESS TO OR ALTERATION OF YOUR TRANSMISSIONS OR DATA;</li>
                  <li>DAMAGES ARISING FROM THIRD-PARTY CONDUCT, INCLUDING SPAM, HACKING, OR OTHER MALICIOUS ACTS;</li>
                  <li>DAMAGES ARISING FROM YOUR FAILURE TO KEEP ACCOUNT CREDENTIALS SECURE;</li>
                  <li>DAMAGES ARISING FROM YOUR RELIANCE ON AI-GENERATED CONTENT;</li>
                </ul>
                <p>
                  WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, OR ANY OTHER
                  THEORY, EVEN IF SENDORA HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
                </p>
                <p>
                  IN NO EVENT WILL SENDORA'S AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING UNDER OR RELATED TO
                  THESE TERMS OR YOUR USE OF THE SERVICES EXCEED THE GREATER OF: (A) THE TOTAL AMOUNTS YOU HAVE PAID
                  TO SENDORA IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE CLAIM; OR (B) INR 500 (INDIAN RUPEES
                  FIVE HUNDRED), IF YOU HAVE NOT MADE ANY PAYMENTS.
                </p>
                <p>
                  THE LIMITATIONS SET FORTH IN THIS SECTION APPLY EVEN IF ANY REMEDY PROVIDED HEREUNDER FAILS OF ITS
                  ESSENTIAL PURPOSE. SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES.
                  IN THOSE JURISDICTIONS, SENDORA'S LIABILITY IS LIMITED TO THE GREATEST EXTENT PERMITTED BY LAW.
                </p>
              </Prose>
            </section>

            {/* ── 19. Indemnification ── */}
            <section id="section-19">
              <SectionHeading n="19" title="Indemnification" />
              <Prose>
                <p>
                  You agree to defend, indemnify, and hold harmless Sendora and its affiliates, officers, directors,
                  employees, agents, partners, and licensors from and against any and all claims, liabilities, damages,
                  losses, costs, and expenses (including reasonable legal fees and court costs) arising out of or
                  relating to:
                </p>
                <ul>
                  <li>your use or misuse of the Services in violation of these Terms;</li>
                  <li>any User Content you submit, send, or make available through the Services;</li>
                  <li>your violation of any applicable law, regulation, or third-party right (including intellectual property rights, privacy rights, or contractual obligations);</li>
                  <li>any dispute or claim between you and any third party arising from your use of the Services;</li>
                  <li>your negligence, wilful misconduct, or fraud.</li>
                </ul>
                <p>
                  Sendora reserves the right, at its own expense, to assume the exclusive defence and control of any
                  matter otherwise subject to indemnification by you, in which case you agree to cooperate with Sendora
                  in asserting any available defences. You agree not to settle any such matter without the prior written
                  consent of Sendora.
                </p>
              </Prose>
            </section>

            {/* ── 20. Account Suspension & Termination ── */}
            <section id="section-20">
              <SectionHeading n="20" title="Account Suspension & Termination" />
              <Prose>
                <p>
                  <strong>Termination by you.</strong> You may terminate your Account at any time by using the account
                  deletion functionality within the Settings section of the Services or by contacting{" "}
                  <strong>support@sendora.me</strong>. Upon termination, your right to use the Services will immediately
                  cease, subject to the provisions of Section 21 below.
                </p>
                <p>
                  <strong>Termination or suspension by Sendora.</strong> Sendora reserves the right to suspend, restrict,
                  or terminate your Account, with or without notice, and without liability, in the following circumstances:
                </p>
                <ul>
                  <li>you have violated, or Sendora reasonably suspects you have violated, any provision of these Terms, including the Acceptable Use Policy and Prohibited Activities;</li>
                  <li>your use of the Services poses a security risk to Sendora, other users, or any third party;</li>
                  <li>your Account has been inactive for an extended period (Sendora will provide at least 30 days' notice of inactivity-based account closure where required by applicable law);</li>
                  <li>Sendora is required to do so by applicable law, regulation, or court order;</li>
                  <li>you fail to pay applicable subscription fees when due;</li>
                  <li>Sendora determines, in its sole discretion, that continued provision of the Services to you is not in the interest of Sendora or its other users.</li>
                </ul>
                <p>
                  Sendora will endeavour to provide advance notice of termination where it is safe and legally permissible
                  to do so. However, in cases involving serious violations of these Terms or imminent security threats,
                  Sendora may suspend or terminate your Account immediately without prior notice.
                </p>
              </Prose>
            </section>

            {/* ── 21. Effect of Termination ── */}
            <section id="section-21">
              <SectionHeading n="21" title="Effect of Termination" />
              <Prose>
                <p>
                  Upon termination of your Account for any reason:
                </p>
                <ul>
                  <li>your licence to use the Services immediately terminates;</li>
                  <li>Sendora may, at its discretion, delete all User Content associated with your Account, including emails, attachments, contacts, settings, and filters, within a commercially reasonable time following termination;</li>
                  <li>any outstanding subscription fees remain due and payable;</li>
                  <li>Sendora is not obligated to retain or provide you with copies of User Content following termination, except as required by applicable law;</li>
                  <li>you will lose access to your Sendora email address, and Sendora may reassign your local part (username) after a reasonable period following account deletion.</li>
                </ul>
                <p>
                  Provisions of these Terms that by their nature should survive termination (including Sections 7, 14,
                  17, 18, 19, 21, 22, 23, and 25) shall survive the termination or expiration of these Terms.
                </p>
              </Prose>
            </section>

            {/* ── 22. Dispute Resolution ── */}
            <section id="section-22">
              <SectionHeading n="22" title="Dispute Resolution" />
              <Prose>
                <p>
                  <strong>Informal resolution.</strong> Before initiating any formal legal proceedings, you agree to
                  first attempt to resolve any dispute, claim, or controversy arising out of or relating to these Terms
                  or the Services (a "Dispute") informally by contacting Sendora at{" "}
                  <strong>support@sendora.me</strong>. Both parties agree to make good-faith efforts to resolve the
                  Dispute within thirty (30) days of notification.
                </p>
                <p>
                  <strong>Arbitration.</strong> If a Dispute cannot be resolved informally within thirty (30) days,
                  the Dispute shall be submitted to and resolved by binding arbitration administered under the rules
                  of the relevant arbitral institution having jurisdiction, unless applicable consumer protection laws
                  in your jurisdiction grant you the right to pursue claims in court. The arbitrator's award shall be
                  final and binding and may be enforced in any court of competent jurisdiction.
                </p>
                <p>
                  <strong>Class action waiver.</strong> To the fullest extent permitted by applicable law, you agree
                  that any Dispute will be brought solely in your individual capacity and not as a plaintiff or class
                  member in any purported class, collective, or representative proceeding.
                </p>
                <p>
                  <strong>Injunctive relief.</strong> Notwithstanding the foregoing, either party may seek emergency
                  injunctive or equitable relief from a court of competent jurisdiction to prevent irreparable harm
                  pending the outcome of arbitration, without waiving the right to arbitrate the underlying Dispute.
                </p>
              </Prose>
            </section>

            {/* ── 23. Governing Law & Jurisdiction ── */}
            <section id="section-23">
              <SectionHeading n="23" title="Governing Law & Jurisdiction" />
              <Prose>
                <p>
                  These Terms and any Dispute arising out of or related to these Terms or your use of the Services
                  shall be governed by and construed in accordance with the laws of <strong>India</strong>, without
                  regard to its conflict-of-law provisions.
                </p>
                <p>
                  Subject to the arbitration clause in Section 22, you and Sendora irrevocably consent to the exclusive
                  jurisdiction of the courts of competent jurisdiction in <strong>India</strong> for the resolution of
                  any Disputes that are not subject to arbitration.
                </p>
                <p>
                  If you are a consumer located in a jurisdiction with mandatory consumer protection laws that provide
                  more favourable protections, those laws may also apply to the extent they cannot be waived by
                  agreement. Nothing in these Terms is intended to limit any rights you may have under applicable
                  mandatory consumer protection law.
                </p>
              </Prose>
            </section>

            {/* ── 24. Changes to These Terms ── */}
            <section id="section-24">
              <SectionHeading n="24" title="Changes to These Terms" />
              <Prose>
                <p>
                  Sendora reserves the right to modify, amend, or update these Terms at any time. When we make
                  material changes, we will:
                </p>
                <ul>
                  <li>update the "Last Updated" date at the top of this page;</li>
                  <li>where required by applicable law or where reasonably practicable, notify you by email to the address associated with your Account or through a prominent notice within the Services.</li>
                </ul>
                <p>
                  Material changes will take effect no sooner than thirty (30) days after the revised Terms are posted,
                  except for changes required by law or to address security concerns, which may take effect immediately.
                </p>
                <p>
                  Your continued use of the Services after the effective date of any revision constitutes your
                  acceptance of the revised Terms. If you do not agree to the revised Terms, you must stop using the
                  Services and delete your Account before the revised Terms take effect.
                </p>
              </Prose>
            </section>

            {/* ── 25. Miscellaneous ── */}
            <section id="section-25">
              <SectionHeading n="25" title="Miscellaneous" />
              <Prose>
                <p>
                  <strong>Entire agreement.</strong> These Terms, together with the Privacy Policy and any additional
                  terms incorporated by reference, constitute the entire agreement between you and Sendora regarding
                  the Services and supersede all prior and contemporaneous understandings, agreements, representations,
                  and warranties, whether written or oral.
                </p>
                <p>
                  <strong>Severability.</strong> If any provision of these Terms is held to be invalid, illegal, or
                  unenforceable by a court of competent jurisdiction, such provision shall be modified to the minimum
                  extent necessary to make it enforceable, or severed from these Terms, and the remaining provisions
                  shall continue in full force and effect.
                </p>
                <p>
                  <strong>Waiver.</strong> Sendora's failure to enforce any right or provision of these Terms shall
                  not constitute a waiver of that right or provision unless acknowledged and agreed to by Sendora in
                  writing. A waiver by Sendora in one instance shall not be deemed a waiver in any other instance.
                </p>
                <p>
                  <strong>Assignment.</strong> You may not assign or transfer any of your rights or obligations under
                  these Terms without the prior written consent of Sendora. Sendora may freely assign its rights and
                  obligations under these Terms, including in connection with a merger, acquisition, reorganisation,
                  or sale of assets, without notice to you, except as required by applicable law.
                </p>
                <p>
                  <strong>No third-party beneficiaries.</strong> These Terms do not create any third-party beneficiary
                  rights. No person other than the parties to these Terms shall have any right to enforce any provision
                  of these Terms.
                </p>
                <p>
                  <strong>Force majeure.</strong> Sendora shall not be liable for any failure or delay in performance
                  resulting from causes beyond its reasonable control, including acts of God, natural disasters, war,
                  terrorism, civil unrest, pandemics, government actions, power failures, internet outages, or
                  third-party infrastructure failures.
                </p>
                <p>
                  <strong>Notices.</strong> All notices from you to Sendora under these Terms must be sent in writing
                  to <strong>support@sendora.me</strong>. Notices from Sendora to you may be sent to the email address
                  associated with your Account or posted within the Services.
                </p>
                <p>
                  <strong>Language.</strong> These Terms are drafted in the English language. In the event of any
                  discrepancy between an English-language version and a translated version, the English-language version
                  shall prevail to the extent permitted by applicable law.
                </p>
              </Prose>
            </section>

            {/* ── 26. Contact Information ── */}
            <section id="section-26">
              <SectionHeading n="26" title="Contact Information" />
              <Prose>
                <p>
                  If you have any questions, concerns, or complaints about these Terms or the Services, please contact
                  us through any of the following channels:
                </p>
                <div className="mt-4 rounded-2xl border border-[#ece9fb] bg-[#faf9ff] p-6 flex flex-col gap-3 text-[13.5px]">
                  <div className="flex gap-3 items-start">
                    <span className="text-[#9c94c2] font-semibold w-24 shrink-0">Email</span>
                    <a href="mailto:support@sendora.me" className="text-[#6d4aff] hover:underline font-medium">support@sendora.me</a>
                  </div>
                  <div className="flex gap-3 items-start">
                    <span className="text-[#9c94c2] font-semibold w-24 shrink-0">Website</span>
                    <a href="https://sendora.me" className="text-[#6d4aff] hover:underline font-medium">sendora.me</a>
                  </div>
                  <div className="flex gap-3 items-start">
                    <span className="text-[#9c94c2] font-semibold w-24 shrink-0">Subject line</span>
                    <span className="text-[#4a4570]">"Terms &amp; Conditions — [Your Query]"</span>
                  </div>
                </div>
                <p>
                  We endeavour to respond to all queries within five (5) business days. For urgent security or legal
                  matters, please indicate the urgency clearly in your subject line.
                </p>
              </Prose>
            </section>

          </div>
        </main>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-[#ede9fc] mt-8">
        <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-[#9c94c2]">
          <p>© {new Date().getFullYear()} Sendora. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/privacy-policy" className="hover:text-[#6d4aff] transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#6d4aff] transition-colors font-medium text-[#6d4aff]">Terms &amp; Conditions</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-start gap-4 mb-5">
      <div className="shrink-0 w-9 h-9 rounded-xl bg-[#f0edfc] flex items-center justify-center text-[13px] font-bold text-[#6d4aff]">
        {n}
      </div>
      <h2 className="text-[20px] font-bold text-[#1c1b33] tracking-tight leading-snug pt-1">{title}</h2>
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 text-[14.5px] text-[#3d3659] leading-[1.78] [&_strong]:text-[#1c1b33] [&_strong]:font-semibold [&_ul]:list-none [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_li]:flex [&_li]:gap-2 [&_li]:before:content-['—'] [&_li]:before:text-[#c4bce8] [&_li]:before:shrink-0 [&_li]:before:mt-[2px] [&_a]:text-[#6d4aff] [&_a]:hover:underline">
      {children}
    </div>
  );
}

function DefinitionList({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-col gap-3 mt-1">
      {items.map(([term, def]) => (
        <div key={term} className="flex gap-3 text-[14px]">
          <span className="shrink-0 font-semibold text-[#1c1b33] w-44">{term}</span>
          <span className="text-[#3d3659] leading-relaxed">{def}</span>
        </div>
      ))}
    </div>
  );
}

function Callout({ children, color }: { children: React.ReactNode; color: "purple" | "amber" | "slate" }) {
  const styles = {
    purple: "bg-[#f5f3ff] border-[#c4b5fd] text-[#4c3d9e]",
    amber:  "bg-[#fffbeb] border-[#fcd34d] text-[#78350f]",
    slate:  "bg-[#f8f7fc] border-[#ddd9f0] text-[#4a4570]",
  };
  return (
    <div className={`rounded-xl border px-5 py-4 text-[13.5px] leading-relaxed ${styles[color]}`}>
      {children}
    </div>
  );
}
