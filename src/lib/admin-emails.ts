import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getEmailDomain, formatUserEmail } from "@/lib/constants";
import { ensurePasswordResetColumns, sha256Hex } from "@/lib/password-reset";
import { sendOutboundMail, isResendConfigured } from "@/lib/resend-mail";
import { getAppBaseUrl } from "@/lib/app-url";

const VERIFY_TTL_MS = 48 * 60 * 60 * 1000;
const RESET_TTL_MS = 24 * 60 * 60 * 1000;

function transactionalFrom(): string {
  return `Sendora <no-reply@${getEmailDomain()}>`;
}

export async function sendAdminPasswordResetEmail(params: {
  localPart: string;
  rawToken: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isResendConfigured()) {
    return {
      ok: false,
      error:
        "Email is not configured (RESEND_API_KEY). Password reset was issued; share the reset link manually or configure Resend.",
    };
  }
  const to = formatUserEmail(params.localPart);
  const base = getAppBaseUrl();
  const link = `${base}/reset-password?token=${encodeURIComponent(params.rawToken)}&username=${encodeURIComponent(params.localPart)}`;
  const subject = "Reset your Sendora password";
  const text = [
    "An administrator triggered a password reset for your Sendora account.",
    "",
    `Open this link to choose a new password (expires in 24 hours):`,
    link,
    "",
    "If you did not expect this message, contact support.",
  ].join("\n");
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.5">
      <p>An administrator triggered a password reset for your Sendora account.</p>
      <p><a href="${link}">Choose a new password</a> (link expires in 24 hours).</p>
      <p style="color:#666;font-size:13px">If you did not expect this message, contact support.</p>
    </div>
  `.trim();
  try {
    await sendOutboundMail({
      from: transactionalFrom(),
      to,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not send email",
    };
  }
}

/**
 * Stores hashed token + expiry and returns raw token for inclusion in email.
 */
export async function issuePasswordResetTokenForUser(userId: string): Promise<string> {
  await ensurePasswordResetColumns();
  const raw = randomBytes(32).toString("hex");
  const hash = sha256Hex(raw);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  await getDb()
    .update(users)
    .set({
      passwordResetTokenHash: hash,
      passwordResetTokenExpiresAt: expiresAt,
      passwordResetTokenUsedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  return raw;
}

export async function issueEmailVerificationTokenForUser(
  userId: string
): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  const hash = sha256Hex(raw);
  const expiresAt = new Date(Date.now() + VERIFY_TTL_MS);
  await getDb()
    .update(users)
    .set({
      emailVerificationTokenHash: hash,
      emailVerificationExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  return raw;
}

export async function sendVerificationEmail(params: {
  localPart: string;
  rawToken: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isResendConfigured()) {
    return {
      ok: false,
      error:
        "Email is not configured (RESEND_API_KEY). Verification link could not be sent.",
    };
  }
  const to = formatUserEmail(params.localPart);
  const base = getAppBaseUrl();
  const link = `${base}/api/auth/verify-email?token=${encodeURIComponent(params.rawToken)}&username=${encodeURIComponent(params.localPart)}`;
  const subject = "Verify your Sendora email";
  const text = [
    "Please verify your email address for your Sendora account.",
    "",
    link,
    "",
    "This link expires in 48 hours.",
  ].join("\n");
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.5">
      <p>Please verify your email address for your Sendora account.</p>
      <p><a href="${link}">Verify email</a></p>
      <p style="color:#666;font-size:13px">This link expires in 48 hours.</p>
    </div>
  `.trim();
  try {
    await sendOutboundMail({
      from: transactionalFrom(),
      to,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not send email",
    };
  }
}
