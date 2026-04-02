import { logError, logInfo } from "@/lib/logger";
import { isResendConfigured, sendOutboundMail } from "@/lib/resend-mail";

/** Verified Sendora domain for transactional mail (Resend). */
export const TRANSACTIONAL_EMAIL_FROM = "Sendora <noreply@sendora.me>";

const WELCOME_REPLY_TO = "team@sendora.me";

/** Extensible list for logging and future templates (OTP, reset, billing, …). */
export type TransactionalEmailKind =
  | "welcome"
  | "otp"
  | "password_reset"
  | "payment_success"
  | "other";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Prefer full name when present; otherwise a readable form of the local part. */
export function welcomeDisplayName(localPart: string, fullName?: string | null): string {
  const n = fullName?.trim();
  if (n) return n;
  if (!localPart.trim()) return "there";
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

function buildWelcomeEmailText(name: string): string {
  return [
    `Hey ${name} 👋`,
    "",
    "Welcome to Sendora! 🎉",
    "",
    "We're really happy to have you as part of Sendora 💙",
    "",
    "Your account has been successfully created, and you're all set to start using our powerful email services.",
    "",
    "---",
    "",
    "🚀 What you can do now:",
    "",
    "• Create your business email 📧",
    "• Use temporary inbox 📥",
    "• Manage everything from your dashboard ⚙️",
    "• Enjoy private worldwide email communication 🌍",
    "",
    "---",
    "",
    "🔐 Why choose Sendora?",
    "",
    "• 🛡️ Privacy First — Your data is fully secure",
    "• 🚫 No Ads — Clean, distraction-free experience",
    "• 💾 Keep Your Backup Files — Store important data safely",
    "• ⚡ Fast, secure, and reliable email service",
    "",
    "---",
    "",
    "💬 Need help?",
    "",
    "If you face any issues or want to share feedback, feel free to email us at:",
    "team@sendora.me",
    "",
    "We're always here to help you 😊",
    "",
    "---",
    "",
    "Thanks again for joining us!",
    "Let's make email better, together 🚀",
    "",
    "— Team Sendora 💙",
  ].join("\n");
}

function buildWelcomeEmailHtml(name: string): string {
  const safe = escapeHtml(name);
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:24px;background:#f6f7fb;color:#1a1a2e;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <p style="margin:0 0 16px;">Hey ${safe} 👋</p>
    <p style="margin:0 0 16px;">Welcome to Sendora! 🎉</p>
    <p style="margin:0 0 16px;">We're really happy to have you as part of Sendora 💙</p>
    <p style="margin:0 0 24px;">Your account has been successfully created, and you're all set to start using our powerful email services.</p>
    <hr style="border:none;border-top:1px solid #e8e8ef;margin:24px 0;" />
    <p style="margin:0 0 12px;font-weight:600;">🚀 What you can do now:</p>
    <ul style="margin:0 0 24px;padding-left:20px;">
      <li>Create your business email 📧</li>
      <li>Use temporary inbox 📥</li>
      <li>Manage everything from your dashboard ⚙️</li>
      <li>Enjoy private worldwide email communication 🌍</li>
    </ul>
    <hr style="border:none;border-top:1px solid #e8e8ef;margin:24px 0;" />
    <p style="margin:0 0 12px;font-weight:600;">🔐 Why choose Sendora?</p>
    <ul style="margin:0 0 24px;padding-left:20px;">
      <li>🛡️ Privacy First — Your data is fully secure</li>
      <li>🚫 No Ads — Clean, distraction-free experience</li>
      <li>💾 Keep Your Backup Files — Store important data safely</li>
      <li>⚡ Fast, secure, and reliable email service</li>
    </ul>
    <hr style="border:none;border-top:1px solid #e8e8ef;margin:24px 0;" />
    <p style="margin:0 0 12px;font-weight:600;">💬 Need help?</p>
    <p style="margin:0 0 16px;">If you face any issues or want to share feedback, feel free to email us at:<br />
    <a href="mailto:team@sendora.me" style="color:#2563eb;">team@sendora.me</a></p>
    <p style="margin:0 0 24px;">We're always here to help you 😊</p>
    <hr style="border:none;border-top:1px solid #e8e8ef;margin:24px 0;" />
    <p style="margin:0 0 8px;">Thanks again for joining us!</p>
    <p style="margin:0 0 24px;">Let's make email better, together 🚀</p>
    <p style="margin:0;color:#64748b;font-size:14px;">— Team Sendora 💙</p>
  </div>
</body>
</html>`.trim();
}

/**
 * Sends the post-signup welcome email via Resend. Does not throw: failures are logged.
 * Signup should call this without awaiting so HTTP response is not blocked.
 */
export async function sendWelcomeEmail(params: {
  to: string;
  /** Shown after "Hey" — use {@link welcomeDisplayName} when you only have localPart. */
  name: string;
  userId?: string;
}): Promise<void> {
  const kind: TransactionalEmailKind = "welcome";
  const to = params.to.trim().toLowerCase();
  if (!to) {
    logError("transactional_email_invalid", { template: kind, reason: "missing_to" });
    return;
  }

  if (!isResendConfigured()) {
    logInfo("transactional_email_skipped", {
      template: kind,
      reason: "resend_not_configured",
      to,
      userId: params.userId ?? "",
    });
    return;
  }

  const name = params.name.trim() || "there";
  const subject = "Welcome to Sendora 🎉";

  try {
    const { id } = await sendOutboundMail({
      from: TRANSACTIONAL_EMAIL_FROM,
      replyTo: WELCOME_REPLY_TO,
      to,
      subject,
      text: buildWelcomeEmailText(name),
      html: buildWelcomeEmailHtml(name),
    });
    logInfo("transactional_email_sent", {
      template: kind,
      status: "success",
      to,
      resendId: id,
      userId: params.userId ?? "",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    logError("transactional_email_failed", {
      template: kind,
      status: "error",
      to,
      userId: params.userId ?? "",
      message: message.slice(0, 500),
    });
  }
}
