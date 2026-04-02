import { randomBytes } from "crypto";
import { formatUserEmail } from "@/lib/constants";
import type { ResolvedFrom } from "@/lib/mail-from";

export const ANONYMOUS_ALIAS_PREFIX = "anon-" as const;

/**
 * Recipient-visible From uses EMAIL_DOMAIN (e.g. anon-…@sendora.me).
 * Internal accountability: anonymous_send_aliases + messages.user_id.
 */
export function generateAnonymousAliasLocalPart(): string {
  const suffix = randomBytes(16).toString("base64url").replace(/[^a-z0-9]/gi, "");
  const safe = (suffix + randomBytes(8).toString("hex")).slice(0, 28);
  return `${ANONYMOUS_ALIAS_PREFIX}${safe}`;
}

export function formatAnonymousOutboundFrom(aliasLocalPart: string): ResolvedFrom {
  const addr = formatUserEmail(aliasLocalPart).toLowerCase();
  const name = "Sendora";
  return {
    from: `${name} <${addr}>`,
    replyTo: addr,
  };
}
