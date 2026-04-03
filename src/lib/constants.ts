export const SESSION_COOKIE = "session";
export const ACCOUNT_BUNDLE_COOKIE = "account_bundle";
export const ADMIN_SESSION_COOKIE = "admin_session";

function normalizeDomain(raw: string | undefined): string | null {
  const v = raw?.trim().toLowerCase();
  if (!v) return null;
  return v.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function getEmailDomain(): string {
  return (
    normalizeDomain(process.env.EMAIL_DOMAIN) ??
    normalizeDomain(process.env.NEXT_PUBLIC_EMAIL_DOMAIN) ??
    normalizeDomain(process.env.NEXT_PUBLIC_APP_URL) ??
    "localhost.test"
  );
}

export function formatUserEmail(localPart: string): string {
  return `${localPart}@${getEmailDomain()}`;
}

/**
 * Builds the RFC 5322 From address for a user's outbound mail.
 * Always uses the user's personal mailbox identity so replies
 * route back correctly and headers show the right domain.
 * Format: "Display Name <localpart@domain>"
 */
export function getOutboundFromAddress(localPart: string, displayName?: string): string {
  const addr = formatUserEmail(localPart);
  const name = (displayName?.trim() || localPart).replace(/"/g, "'");
  return `${name} <${addr}>`;
}

/** The bare email address without display name, e.g. for Reply-To. */
export function getUserMailboxAddress(localPart: string): string {
  return formatUserEmail(localPart);
}

export function getProfessionalRootDomain(): string {
  return process.env.PROFESSIONAL_ROOT_DOMAIN ?? "sendora.me";
}

export function formatProfessionalEmail(handle: string): string {
  const h = handle.trim().toLowerCase();
  return `${h}@${h}.${getProfessionalRootDomain()}`;
}
