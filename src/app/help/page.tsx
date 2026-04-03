"use client";

import { useState } from "react";
import Link from "next/link";

const categories = [
  {
    id: "getting-started",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
        <path d="M12 2L2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    ),
    label: "Getting Started",
    count: 6,
  },
  {
    id: "account",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
    label: "Account & Profile",
    count: 7,
  },
  {
    id: "inbox",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
        <rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 10 7 10-7"/>
      </svg>
    ),
    label: "Inbox & Email",
    count: 8,
  },
  {
    id: "security",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>
      </svg>
    ),
    label: "Security & Privacy",
    count: 7,
  },
  {
    id: "temp-inbox",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    label: "Temporary Inbox",
    count: 5,
  },
  {
    id: "custom-domains",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
        <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
    label: "Custom Domains",
    count: 6,
  },
  {
    id: "billing",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
        <rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>
      </svg>
    ),
    label: "Billing & Plans",
    count: 7,
  },
  {
    id: "ai-features",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
        <path d="M12 2a5 5 0 0 1 5 5c0 1.5-.6 2.9-1.6 3.8L17 22H7l1.6-11.2A5 5 0 0 1 7 7a5 5 0 0 1 5-5Z"/><path d="M9 22h6"/>
      </svg>
    ),
    label: "AI Features",
    count: 5,
  },
  {
    id: "troubleshooting",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
      </svg>
    ),
    label: "Troubleshooting",
    count: 6,
  },
];

const faqs: Record<string, { q: string; a: string }[]> = {
  "getting-started": [
    {
      q: "How do I create a Sendora account?",
      a: "Creating a Sendora account is straightforward. Navigate to sendora.me and click 'Get Started' or 'Sign Up'. You will be guided through a brief registration process in which you select your preferred email address (in the format you@sendora.me), establish a secure passphrase, and optionally configure a passkey for hardware-backed authentication. No phone number, credit card, or identity verification is required to create a free account. Your inbox is operational immediately upon completion of registration.",
    },
    {
      q: "What is the difference between a free account and a paid plan?",
      a: "Sendora's free tier provides a fully functional personal email inbox at @sendora.me, with generous sending and storage limits suitable for everyday use. Paid plans — Pro and Business — unlock advanced capabilities including custom domain email addresses (e.g. you@yourcompany.com), expanded storage, higher send limits, priority message delivery, advanced AI features such as smart summarisation and composition assistance, and access to enhanced security controls. A full feature comparison is available on the Pricing page.",
    },
    {
      q: "Can I use Sendora immediately after signing up, or is there a waiting period?",
      a: "Your Sendora inbox is active immediately upon account creation. There is no waitlist, verification delay, or manual approval process for standard accounts. Once you complete registration, you can send and receive email from your new @sendora.me address without any further steps.",
    },
    {
      q: "Is a phone number required to sign up?",
      a: "No. Sendora does not require a phone number at any stage of registration or account management. This is a deliberate design decision rooted in our privacy-first philosophy — we believe you should not need to surrender personal identifying information simply to obtain a private email address. Email verification is also not required for account creation.",
    },
    {
      q: "Which devices and browsers are supported?",
      a: "Sendora is a web-based application accessible via any modern browser, including Google Chrome, Mozilla Firefox, Apple Safari, and Microsoft Edge. The interface is fully responsive and optimised for use on desktop computers, laptops, tablets, and mobile smartphones. Native mobile applications are under active development and will be announced separately.",
    },
    {
      q: "How do I import emails or contacts from another email provider?",
      a: "At present, Sendora does not provide an automated import tool for historical emails or contact lists from external providers. This capability is on our development roadmap. In the interim, you may forward existing important emails to your Sendora address manually, or configure forwarding rules within your previous provider to route incoming messages to your new Sendora inbox.",
    },
  ],
  "account": [
    {
      q: "How do I change my display name or profile information?",
      a: "Your display name and other profile details can be updated from the Settings page within your Sendora dashboard. Navigate to Settings → Profile and modify the relevant fields. Changes take effect immediately and will be reflected in the 'From' name displayed to recipients of your emails.",
    },
    {
      q: "How do I change my password?",
      a: "To change your account password, go to Settings → Security → Change Password. You will be required to confirm your current password before setting a new one. Sendora employs Argon2id — a state-of-the-art password hashing algorithm — to ensure that your credentials are stored in a manner that cannot be reversed, even in the event of a data breach. We recommend choosing a long, unique passphrase that is not reused across other services.",
    },
    {
      q: "What are passkeys, and how do I set one up?",
      a: "Passkeys are a modern, phishing-resistant authentication mechanism based on the WebAuthn/FIDO2 standard. Unlike passwords, passkeys are cryptographic key pairs — the private key is stored securely on your device (e.g. in your phone's secure enclave or a hardware security key), and the public key is registered with Sendora. Authentication occurs via biometrics (fingerprint or Face ID) or a device PIN, meaning your credentials are never transmitted over the network and cannot be intercepted or phished. To set up a passkey, go to Settings → Security → Passkeys and follow the on-screen instructions.",
    },
    {
      q: "How do I enable two-factor authentication?",
      a: "Sendora supports hardware-backed passkey authentication as a primary strong authentication mechanism. We recommend enrolling at least one passkey as your primary second factor. Additional security features, including session management and active session review, are available under Settings → Security. We actively discourage reliance on SMS-based two-factor authentication due to its well-documented vulnerability to SIM-swap attacks.",
    },
    {
      q: "Can I have multiple email addresses on one account?",
      a: "Yes. Depending on your plan, you may create multiple mailbox identities and email aliases within a single Sendora account. Pro and Business subscribers can add custom domain addresses and configure additional identities for different purposes — for example, a personal address, a professional address, and anonymous sending aliases — all managed from a single dashboard.",
    },
    {
      q: "How do I delete my account?",
      a: "Account deletion can be initiated from Settings → Account → Delete Account. This action is irreversible. Upon deletion, all associated emails, contacts, settings, and account data are permanently purged from our systems in accordance with our data retention policy. We recommend exporting any correspondence you wish to retain before initiating the deletion process. Paid subscriptions must be cancelled before account deletion; any remaining prepaid period is forfeited upon deletion.",
    },
    {
      q: "How do I review and manage active login sessions?",
      a: "Sendora maintains a full audit log of active and historical login sessions, accessible from Settings → Security → Active Sessions. Each entry records the device, browser, approximate location (derived from IP address using anonymised geolocation), and timestamp of the login event. You may revoke any individual session or terminate all sessions except the current one at any time. We recommend reviewing this list periodically to detect any unauthorised access.",
    },
  ],
  "inbox": [
    {
      q: "How do I compose and send an email?",
      a: "To compose a new email, click the 'Compose' button within your inbox. Sendora's composer is built on Tiptap, a rich-text editing engine, and supports formatted text, inline images, hyperlinks, and standard typographic controls. Enter the recipient's email address in the 'To' field, add a subject, compose your message, and click 'Send'. You may also schedule emails for future delivery.",
    },
    {
      q: "How do I organise my inbox with folders or labels?",
      a: "Sendora provides a structured inbox view with categories for Primary, Sent, Drafts, Archived, and Spam. Custom folder and label management features are available to Pro and Business subscribers. You may drag messages between categories, apply filters, and create rules to automatically sort incoming messages based on sender, subject, or content patterns.",
    },
    {
      q: "What is the maximum email size and attachment limit?",
      a: "Sendora supports email attachments up to 25 MB per message, in line with industry standards. If you need to share larger files, we recommend using a cloud storage service and including a link within the email body. Total mailbox storage varies by plan: free accounts receive 1 GB, Pro accounts receive 15 GB, and Business accounts receive 50 GB per user.",
    },
    {
      q: "How does Anonymous Sending work?",
      a: "Anonymous Sending allows you to dispatch an email without disclosing your actual @sendora.me address to the recipient. When enabled, Sendora generates a cryptographic alias address through which your message is routed — the recipient sees only the alias, and your true identity is protected. Replies to the alias are forwarded to your inbox. This feature is available to Pro and Business subscribers and is designed for contexts where you wish to protect your personal address while maintaining the ability to receive responses.",
    },
    {
      q: "Can I schedule emails to be sent at a later time?",
      a: "Yes. The Sendora composer includes a scheduling option accessible via the send button dropdown. Select 'Schedule Send', choose your desired date and time, and confirm. Scheduled emails are held securely and dispatched at the specified time. You may review, edit, or cancel scheduled messages from the Drafts/Scheduled folder at any time prior to dispatch.",
    },
    {
      q: "How does Sendora handle spam and phishing emails?",
      a: "Sendora employs a multi-layer filtering architecture that analyses incoming messages for spam indicators, known phishing patterns, malicious links, and suspicious sender behaviour. Messages classified as spam are automatically quarantined in your Spam folder. Importantly, our filtering system operates without reading the semantic content of your emails — it relies on structural and metadata signals rather than content scanning. You can mark messages as spam or 'not spam' to improve filtering accuracy for your inbox.",
    },
    {
      q: "Is there a search function for my emails?",
      a: "Yes. Sendora provides full-text search across your inbox, enabling you to locate emails by sender, subject, recipient, date range, or keywords within the message body. Search results are returned instantly and ranked by relevance. Advanced search operators (such as from:, to:, subject:, before:, after:) allow highly precise queries for users who manage large volumes of correspondence.",
    },
    {
      q: "Can I access my Sendora email via a third-party email client (IMAP/SMTP)?",
      a: "IMAP and SMTP access for third-party email clients (such as Apple Mail, Thunderbird, or Outlook) is currently available to Business plan subscribers. Configuration details, including server addresses and port settings, are provided in Settings → Account → External Access. Free and Pro subscribers may continue to use the Sendora web interface, which is optimised for all major browsers and screen sizes.",
    },
  ],
  "security": [
    {
      q: "How does Sendora protect my password?",
      a: "Sendora uses Argon2id for password hashing — the current gold standard in cryptographic password protection, and winner of the Password Hashing Competition. Argon2id is a memory-hard algorithm deliberately designed to be computationally expensive to brute-force, even with specialised hardware. Your password is never stored in plain text or in a reversible form. Even Sendora's own engineers cannot retrieve or view your password.",
    },
    {
      q: "Does Sendora read or scan my emails for advertising purposes?",
      a: "No. Sendora operates on a subscription-based commercial model, which means we have no financial incentive to read, analyse, or monetise the content of your emails. We do not serve advertisements, we do not sell user data to third parties, and we do not engage in content-based profiling. Our spam filtering system uses structural and metadata signals — not semantic content analysis — to protect your inbox.",
    },
    {
      q: "What data does Sendora collect about me?",
      a: "Sendora collects the minimum data necessary to provide the service: your chosen email address, a hashed version of your password (which cannot be reversed), session tokens for authentication, and the emails you send and receive. We collect anonymised login metadata (device type, approximate location from IP address) solely for security auditing purposes — specifically, to help you detect unauthorised access attempts. We do not collect behavioural analytics, browsing history, or any data beyond what is strictly required to operate the platform.",
    },
    {
      q: "What should I do if I suspect my account has been compromised?",
      a: "If you believe your account has been accessed without authorisation, take the following steps immediately: (1) Change your password from Settings → Security → Change Password. (2) Review active sessions from Settings → Security → Active Sessions and revoke all sessions you do not recognise. (3) Enrol a passkey if you have not already done so, to prevent future password-based attacks. (4) Contact our support team at support@sendora.me with details of the suspected compromise. We will assist with account recovery and security hardening.",
    },
    {
      q: "How are my emails transmitted — is the connection encrypted?",
      a: "All data transmitted between your browser and Sendora's servers is encrypted using TLS (Transport Layer Security), the same protocol used by banks and financial institutions. Email transmission between Sendora and other mail servers uses opportunistic TLS wherever the recipient's server supports it. End-to-end encryption (where only you and your recipient can read the message) is on our development roadmap as a forthcoming feature.",
    },
    {
      q: "What is Sendora's policy on government data requests and legal orders?",
      a: "Sendora takes a firm position in favour of user privacy when responding to legal requests. We will comply only with requests that are lawful, properly constituted, and narrowly scoped. We will notify affected users of any legal request to the maximum extent permitted by law. We maintain a transparency report (forthcoming) documenting the number and nature of requests received. We will always challenge overbroad or legally deficient orders.",
    },
    {
      q: "How do I report a security vulnerability in Sendora?",
      a: "Sendora operates a responsible disclosure programme for security researchers who identify vulnerabilities in our platform. If you have discovered a potential security issue, please contact us immediately at support@sendora.me with the subject line 'Security Disclosure'. Please do not disclose the vulnerability publicly until we have had a reasonable opportunity to investigate and remediate. We treat all responsible disclosures seriously and will acknowledge receipt within one business day.",
    },
  ],
  "temp-inbox": [
    {
      q: "What is the Temporary Inbox feature?",
      a: "The Temporary Inbox is a disposable email address that allows you to receive emails without revealing your primary Sendora address. It is designed for situations where you need to register on a website, verify a service, or receive a one-time communication without creating a permanent association between your identity and that service. Messages received in your Temporary Inbox are automatically deleted after a configurable period.",
    },
    {
      q: "How long do messages in the Temporary Inbox persist?",
      a: "By default, messages in your Temporary Inbox are retained for 24 hours, after which they are permanently and irrecoverably deleted from our systems. Pro subscribers can extend this retention window. The automatic deletion mechanism is a core privacy feature — it ensures that no long-lived record of your temporary correspondence is retained on our infrastructure. There is no manual 'save' function for Temporary Inbox messages; if you need to retain content, copy it before the expiry window.",
    },
    {
      q: "Can I create a custom temporary email address, or is it randomly generated?",
      a: "When you access the Temporary Inbox, Sendora generates a unique random address within the @sendora.me domain. This address is deterministically linked to your session but not to your permanent account identity. Pro subscribers may configure a preferred prefix for their temporary address, subject to availability. The full address remains within the @sendora.me domain regardless of customisation.",
    },
    {
      q: "Is the Temporary Inbox available on the free plan?",
      a: "Yes. Basic Temporary Inbox functionality — including a random address and 24-hour message retention — is available to all Sendora users, including those on the free plan. Extended retention periods, custom address prefixes, and enhanced Temporary Inbox features are available to Pro and Business subscribers.",
    },
    {
      q: "Can I reply to emails received in my Temporary Inbox?",
      a: "No. The Temporary Inbox is a receive-only facility by design. It is intended exclusively for situations where you need to receive a message (such as an account verification email) without establishing an ongoing correspondence relationship. If you need to respond to the sender, you should do so from your primary Sendora address or via the Anonymous Sending feature.",
    },
  ],
  "custom-domains": [
    {
      q: "What is a custom domain email address?",
      a: "A custom domain email address allows you to send and receive email using your own domain name — for example, you@yourcompany.com or hello@yourbrand.io — rather than the standard @sendora.me address. Custom domain email is available to Pro and Business plan subscribers. It enables individuals and organisations to maintain a professional, branded email identity while benefiting from Sendora's privacy-first infrastructure.",
    },
    {
      q: "How do I connect my own domain to Sendora?",
      a: "To connect a custom domain, navigate to Settings → Domains → Add Domain and enter your domain name. Sendora will generate a set of DNS records (including MX, TXT, and optionally DKIM records) that you must add to your domain's DNS configuration via your domain registrar or DNS provider. The verification process typically takes between a few minutes and 48 hours, depending on your DNS provider's propagation speed. Once verified, you can begin sending and receiving email at your custom domain immediately.",
    },
    {
      q: "How many custom domains can I connect?",
      a: "Pro subscribers may connect up to three custom domains. Business subscribers may connect an unlimited number of custom domains. Each domain must pass DNS verification before it becomes active. You can manage all connected domains, review their verification status, and remove domains from Settings → Domains.",
    },
    {
      q: "What DNS records do I need to configure for my custom domain?",
      a: "Sendora requires the following DNS records: (1) MX records pointing to Sendora's mail servers, to route incoming email for your domain to your Sendora inbox. (2) A TXT record for domain ownership verification. (3) DKIM records (recommended) to cryptographically sign outgoing messages, improving deliverability and protecting against email spoofing. (4) SPF records (recommended) to authorise Sendora's servers to send email on behalf of your domain. Sendora provides the exact values for each record within the domain setup interface.",
    },
    {
      q: "What happens to email sent to my custom domain if I cancel my subscription?",
      a: "If your subscription lapses or is cancelled and your plan no longer supports custom domains, your custom domain email addresses will cease to function. Incoming email sent to your custom domain will bounce back to the sender. Your domain ownership is unaffected — you retain full ownership of your domain and may reconnect it if you reactivate a qualifying subscription. We recommend ensuring continuity of service by maintaining an active subscription or arranging alternative mail handling for your domain prior to cancellation.",
    },
    {
      q: "Can I set up catch-all email routing for my custom domain?",
      a: "Yes. Business plan subscribers can configure catch-all routing for their custom domain, which means any email sent to any address at your domain (e.g. anything@yourdomain.com) will be delivered to a designated inbox, even if that specific address has not been explicitly created. This is useful for ensuring no email is lost due to typos or for creating de-facto unlimited aliases without pre-configuring each one individually.",
    },
  ],
  "billing": [
    {
      q: "What payment methods does Sendora accept?",
      a: "Sendora processes payments via Razorpay, which supports a wide range of payment methods including major credit and debit cards (Visa, Mastercard, Rupay), UPI, net banking, and select digital wallets. Available payment methods may vary by region. All payment information is handled directly by Razorpay's PCI DSS-compliant infrastructure — Sendora does not store your full card number or banking credentials.",
    },
    {
      q: "How do I upgrade or downgrade my subscription plan?",
      a: "Subscription changes can be made from Settings → Billing → Manage Plan. When upgrading, you will be charged a prorated amount for the remainder of the current billing cycle. When downgrading, the change takes effect at the end of the current billing period, and your current plan's features remain available until that date. Downgrading to the free tier will deactivate features not included in the free plan, such as custom domain email addresses.",
    },
    {
      q: "Is there a free trial for paid plans?",
      a: "Sendora offers a fully functional free tier that you can use indefinitely without a credit card. This allows you to evaluate the core platform before committing to a paid subscription. Promotional trial periods for paid features may be offered from time to time — check the Pricing page for current offers.",
    },
    {
      q: "How do I cancel my subscription?",
      a: "You may cancel your subscription at any time from Settings → Billing → Cancel Subscription. Upon cancellation, your paid plan features remain accessible until the end of the current billing period. After expiry, your account reverts to the free tier automatically. Cancellation does not delete your account or emails — your data is retained in accordance with our privacy policy.",
    },
    {
      q: "Can I get a refund if I'm not satisfied?",
      a: "Sendora evaluates refund requests on a case-by-case basis. If you experience a technical issue that substantially prevents you from using the service, or if you were inadvertently charged incorrectly, please contact support@sendora.me within 7 days of the charge with details of your concern. We are committed to treating all refund requests fairly and transparently.",
    },
    {
      q: "How do I access my invoices and billing history?",
      a: "All invoices and transaction records are accessible from Settings → Billing → Invoice History. Each invoice includes a detailed breakdown of charges, applicable taxes, and the payment method used. Invoices can be downloaded in PDF format for record-keeping or accounting purposes.",
    },
    {
      q: "Do subscription prices include taxes?",
      a: "Subscription prices displayed on the Pricing page are exclusive of applicable taxes. Depending on your country or region of residence, GST, VAT, or other indirect taxes may be applied to your invoice in accordance with local regulatory requirements. The applicable tax rate will be clearly displayed at checkout prior to payment confirmation.",
    },
  ],
  "ai-features": [
    {
      q: "What AI-powered features does Sendora offer?",
      a: "Sendora integrates artificial intelligence to enhance productivity without compromising privacy. Current AI features include: Smart Compose (context-aware sentence completion as you type), Email Summarisation (a concise digest of lengthy threads), Smart Reply suggestions (pre-drafted responses based on message context), and Subject Line Generation (automatically suggested subjects based on email content). AI features are available to Pro and Business subscribers.",
    },
    {
      q: "Does Sendora's AI read or store my email content?",
      a: "AI features in Sendora process your email content locally in context to generate suggestions — this processing does not result in your emails being stored, indexed, or used to train AI models. We do not share your email content with third-party AI providers in a manner that retains or associates your data with your identity. Our AI integration is designed specifically to provide the productivity benefits of intelligent assistance while upholding our commitment to user privacy.",
    },
    {
      q: "How does Smart Compose work?",
      a: "Smart Compose analyses the context of your email as you type — including the content you have already written, the subject line, and optionally prior exchanges in the thread — and offers real-time word and sentence completions. Suggestions appear inline and can be accepted with the Tab key or ignored. Smart Compose is powered by Google Gemini and is configured to operate in a privacy-preserving mode that does not retain conversation history.",
    },
    {
      q: "Can I disable AI features if I prefer not to use them?",
      a: "Yes. All AI features in Sendora are opt-in and can be individually enabled or disabled from Settings → AI & Productivity. If you prefer to compose and manage your email without AI assistance, you may turn off all AI features at any time. This preference is saved to your account and persists across sessions and devices.",
    },
    {
      q: "Are AI features available in languages other than English?",
      a: "Sendora's AI features currently offer best-in-class performance for English-language content. Support for additional languages — including Hindi, Spanish, French, German, and others — is actively under development and will be rolled out progressively. The underlying Gemini model has multilingual capability, and language expansion is a near-term priority on our product roadmap.",
    },
  ],
  "troubleshooting": [
    {
      q: "I'm not receiving emails in my inbox. What should I do?",
      a: "If emails are not arriving in your inbox, check the following: (1) Verify that the sender used the correct email address. (2) Check your Spam folder — some legitimate emails may be incorrectly classified. (3) Ensure your mailbox storage quota has not been exceeded (visible in Settings → Account). (4) If you are using a custom domain, confirm that your MX DNS records are correctly configured and propagated. (5) If the issue persists after checking all of the above, contact support@sendora.me with details of the missing message, including the sender's address and approximate send time.",
    },
    {
      q: "My emails are being delivered to recipients' spam folders. How do I fix this?",
      a: "Email deliverability depends on several factors. To improve it: (1) Ensure your custom domain has properly configured SPF, DKIM, and DMARC DNS records — these cryptographically vouch for your identity as a sender and significantly improve deliverability. (2) Avoid sending emails with excessive links, all-caps text, or patterns commonly associated with spam. (3) Ensure recipients have added your address to their contacts list. (4) If you are sending to a large list, ensure recipients have opted in to receive your messages. Contact support if deliverability issues persist.",
    },
    {
      q: "I forgot my password and cannot log in. How do I recover my account?",
      a: "If you have forgotten your password, navigate to the login page and click 'Forgot Password'. Enter the email address associated with your Sendora account, and a password reset link will be sent to your registered recovery email address (if configured) or to your Sendora address itself if accessible. If you have a passkey enrolled on your device, you may also authenticate via passkey without requiring your password. If you are unable to access your account via any method, contact support@sendora.me for assisted account recovery.",
    },
    {
      q: "The Sendora interface is loading slowly or not displaying correctly. What can I do?",
      a: "If you are experiencing performance issues or visual rendering problems: (1) Perform a hard refresh of the page (Ctrl+Shift+R on Windows/Linux, Cmd+Shift+R on macOS). (2) Clear your browser's cache and cookies. (3) Try accessing Sendora in an incognito/private browsing window to rule out browser extension conflicts. (4) Ensure your browser is updated to the latest version. (5) If the issue persists across different browsers and devices, it may indicate a temporary service disruption — check our Status page or contact support.",
    },
    {
      q: "I'm receiving a 'Session Expired' error. Why does this happen?",
      a: "Sendora enforces session time limits as a security measure — sessions are automatically invalidated after a period of inactivity to protect your account in the event your device is left unattended or accessed by an unauthorised party. If you encounter a session expiry, simply log in again. If you are experiencing unusually frequent session expirations, ensure that cookies are enabled in your browser and that no extensions are blocking session storage. Check Settings → Security → Active Sessions to review your current session state.",
    },
    {
      q: "An email I sent has not been delivered to the recipient. How do I check the status?",
      a: "Sent emails are recorded in your Sent folder immediately upon dispatch. If a delivery failure occurs — for instance, because the recipient's address does not exist or their mail server rejected the message — Sendora will generate a non-delivery report (NDR) and deliver it to your inbox, typically within a few minutes. If no NDR is received and the recipient confirms they have not received your message, check your Spam folder (some servers send delayed NDRs) and contact support with the message details if the issue remains unresolved.",
    },
  ],
};

function AccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`border rounded-xl transition-colors ${open ? "border-[#6d4aff]/30 bg-white/[0.04]" : "border-white/[0.06] bg-white/[0.02]"}`}
    >
      <button
        className="w-full flex items-start justify-between gap-4 px-6 py-5 text-left group"
        onClick={() => setOpen(!open)}
      >
        <span className="text-[14.5px] font-semibold text-white/85 leading-snug group-hover:text-white transition-colors">
          {q}
        </span>
        <span
          className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 transition-all duration-200 ${open ? "bg-[#6d4aff] rotate-45" : "bg-white/[0.06]"}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5 text-white">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </span>
      </button>
      {open && (
        <div className="px-6 pb-6">
          <div className="h-px bg-white/[0.06] mb-5" />
          <p className="text-[13.5px] text-white/55 leading-[1.85]">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const [activeCategory, setActiveCategory] = useState("getting-started");

  const activeCat = categories.find((c) => c.id === activeCategory);
  const items = faqs[activeCategory] ?? [];

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
        <div className="relative mx-auto max-w-6xl px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-[#6d4aff]/15 border border-[#6d4aff]/25">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[#a78bff]">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd"/>
            </svg>
            <span className="text-[11px] font-semibold text-[#a78bff] uppercase tracking-wider">Help Center</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-5 leading-[1.08]">
            How can we<br />
            <span className="bg-gradient-to-r from-[#a78bff] via-[#7c6aff] to-[#6d4aff] bg-clip-text text-transparent">
              help you?
            </span>
          </h1>
          <p className="text-[16px] sm:text-[17px] text-white/48 max-w-2xl mx-auto leading-relaxed mb-10">
            Comprehensive answers to every question about Sendora — from account setup and security
            to billing, AI features, and advanced configuration.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06] max-w-xl mx-auto">
            {[
              { value: "9", label: "Help Categories" },
              { value: "57+", label: "Articles" },
              { value: "< 24h", label: "Support Response" },
            ].map(({ value, label }) => (
              <div key={label} className="bg-[#0d0b1e]/60 px-5 py-6 flex flex-col items-center gap-1">
                <span className="text-2xl font-extrabold text-white tracking-tight">{value}</span>
                <span className="text-[11.5px] text-white/35 font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Main Content ── */}
      <section className="border-t border-white/[0.05] flex-1">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-col lg:flex-row gap-10">

            {/* ── Sidebar ── */}
            <aside className="lg:w-64 shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 mb-4 px-1">Categories</p>
              <nav className="flex flex-col gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                      activeCategory === cat.id
                        ? "bg-[#6d4aff]/15 border border-[#6d4aff]/30 text-white"
                        : "border border-transparent text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className={`shrink-0 ${activeCategory === cat.id ? "text-[#a78bff]" : "text-white/30"}`}>
                      {cat.icon}
                    </span>
                    <span className="text-[13px] font-medium flex-1">{cat.label}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeCategory === cat.id ? "bg-[#6d4aff]/25 text-[#a78bff]" : "bg-white/[0.05] text-white/25"}`}>
                      {cat.count}
                    </span>
                  </button>
                ))}
              </nav>

              {/* Support card */}
              <div className="mt-8 p-5 rounded-2xl bg-gradient-to-b from-[#110e28] to-[#0d0b1e] border border-white/[0.08]">
                <div className="w-9 h-9 rounded-xl bg-[#6d4aff]/15 text-[#a78bff] flex items-center justify-center mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4.5 h-4.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <p className="text-[13px] font-semibold text-white mb-1.5">Still have questions?</p>
                <p className="text-[12px] text-white/40 leading-relaxed mb-4">
                  Our support team is here to help with anything not covered in this Help Center.
                </p>
                <a
                  href="mailto:support@sendora.me"
                  className="block w-full text-center py-2.5 rounded-xl bg-[#6d4aff]/20 border border-[#6d4aff]/30 text-[#a78bff] text-[12.5px] font-semibold hover:bg-[#6d4aff]/30 transition-colors"
                >
                  Contact Support
                </a>
              </div>
            </aside>

            {/* ── Articles ── */}
            <div className="flex-1 min-w-0">
              {/* Category header */}
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/[0.06]">
                <div className="w-12 h-12 rounded-2xl bg-[#6d4aff]/12 text-[#a78bff] flex items-center justify-center shrink-0">
                  {activeCat?.icon}
                </div>
                <div>
                  <h2 className="text-[22px] font-extrabold text-white tracking-tight leading-tight">
                    {activeCat?.label}
                  </h2>
                  <p className="text-[13px] text-white/35 mt-0.5">
                    {activeCat?.count} articles in this section
                  </p>
                </div>
              </div>

              {/* Accordion items */}
              <div className="flex flex-col gap-3">
                {items.map(({ q, a }) => (
                  <AccordionItem key={q} q={q} a={a} />
                ))}
              </div>

              {/* Bottom navigation hint */}
              <div className="mt-12 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                <div>
                  <p className="text-[14px] font-semibold text-white mb-1">Couldn't find what you're looking for?</p>
                  <p className="text-[13px] text-white/40 leading-relaxed">
                    Browse other categories from the sidebar, or reach out directly to our support team.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    href="/contact"
                    className="px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-[13px] text-white/60 font-medium hover:text-white hover:border-white/[0.15] transition-all"
                  >
                    Contact page
                  </Link>
                  <a
                    href="mailto:support@sendora.me"
                    className="px-4 py-2.5 rounded-xl bg-[#6d4aff] text-white text-[13px] font-semibold hover:bg-[#7d5aff] transition-colors"
                  >
                    Email Support
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05]">
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
            <Link href="/privacy-policy" className="hover:text-white/60 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
            <Link href="/help" className="hover:text-white/60 transition-colors text-[#a78bff]">Help</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
