import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  businessProfiles,
  domains,
  mailboxes,
  professionalProfiles,
  users,
} from "@/db/schema";
import {
  getOutboundFromAddress,
  getUserMailboxAddress,
} from "@/lib/constants";
import { isBusinessPlan } from "@/lib/plan";
import { getAdminSystemSettings } from "@/lib/admin-system-settings";

export type ResolvedFrom = {
  from: string;
  replyTo: string;
};

/**
 * Build From/Reply-To: optional mailbox (business custom domain) or default
 * mailbox or free account address.
 */
export async function resolveSendFromForUser(args: {
  user: typeof users.$inferSelect;
  mailboxId?: string | null;
}): Promise<ResolvedFrom> {
  const { user, mailboxId } = args;
  const db = getDb();
  const systemSettings = await getAdminSystemSettings();
  // Professional is intentionally disabled; ignore any `pro:` mailbox selection.
  const PROFESSIONAL_DISABLED = true;

  const loadProfile = async () => {
    const p = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, user.id))
      .limit(1);
    return p[0] ?? null;
  };

  if (!PROFESSIONAL_DISABLED && mailboxId?.startsWith("pro:")) {
    const pro = await db
      .select()
      .from(professionalProfiles)
      .where(eq(professionalProfiles.userId, user.id))
      .limit(1);
    const row = pro[0];
    if (row) {
      const name = (row.displayName?.trim() || row.handle).replace(/"/g, "'");
      const addr = row.emailAddress.toLowerCase();
      return { from: `${name} <${addr}>`, replyTo: addr };
    }
  }

  const byId = mailboxId
    ? await db
        .select({
          mailbox: mailboxes,
          domain: domains,
        })
        .from(mailboxes)
        .innerJoin(domains, eq(mailboxes.domainId, domains.id))
        .where(
          and(
            eq(mailboxes.id, mailboxId),
            eq(domains.ownerUserId, user.id),
            eq(domains.verificationStatus, "verified"),
            eq(domains.operationalStatus, "active"),
            eq(domains.sendingEnabled, true),
            eq(mailboxes.active, true)
          )
        )
        .limit(1)
    : [];

  if (byId.length > 0) {
    const { mailbox: mb, domain: dom } = byId[0]!;
    const profile = await loadProfile();
    const display =
      mb.displayNameOverride?.trim() ||
      profile?.displayNameDefault?.trim() ||
      profile?.businessName?.trim() ||
      mb.localPart;
    const name = display.replace(/"/g, "'");
    const addr = mb.emailAddress.toLowerCase();
    return {
      from: `${name} <${addr}>`,
      replyTo: addr,
    };
  }

  if (!isBusinessPlan(user)) {
    return {
      from: getOutboundFromAddress(user.localPart),
      replyTo: getUserMailboxAddress(user.localPart),
    };
  }

  const defaultMb = await db
    .select({
      mailbox: mailboxes,
    })
    .from(mailboxes)
    .innerJoin(domains, eq(mailboxes.domainId, domains.id))
    .where(
      and(
        eq(domains.ownerUserId, user.id),
        eq(mailboxes.isDefaultSender, true),
        eq(mailboxes.active, true),
        eq(domains.verificationStatus, "verified"),
        eq(domains.operationalStatus, "active"),
        eq(domains.sendingEnabled, true)
      )
    )
    .limit(1);

  if (defaultMb.length > 0) {
    const mb = defaultMb[0]!.mailbox;
    const profile = await loadProfile();
    const display =
      mb.displayNameOverride?.trim() ||
      profile?.displayNameDefault?.trim() ||
      profile?.businessName?.trim() ||
      mb.localPart;
    const name = display.replace(/"/g, "'");
    const addr = mb.emailAddress.toLowerCase();
    return {
      from: `${name} <${addr}>`,
      replyTo: addr,
    };
  }

  return {
    from: `${user.localPart} via ${systemSettings.general.appName} <${systemSettings.email.defaultSenderEmail}>`,
    replyTo: getUserMailboxAddress(user.localPart),
  };
}
