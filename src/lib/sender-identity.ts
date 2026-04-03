import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  businessProfiles,
  domains,
  mailboxes,
  professionalProfiles,
  users,
} from "@/db/schema";
import { getEmailDomain } from "@/lib/constants";
import { shouldShowGoldenTick } from "@/lib/plan";

export type SenderIdentity = {
  email: string;
  displayName: string;
  goldenTick: boolean;
  businessName: string | null;
  logoUrl: string | null;
  brandColor: string | null;
};

function normalizeEmail(addr: string): string {
  const m = addr.match(/<([^>]+)>/);
  const raw = (m ? m[1] : addr).trim();
  return raw.toLowerCase();
}

function defaultIdentity(
  raw: string,
  email: string,
  displayName: string
): SenderIdentity {
  return {
    email,
    displayName,
    goldenTick: false,
    businessName: null,
    logoUrl: null,
    brandColor: null,
  };
}

/**
 * Resolve sender display info for raw From header values (batch).
 * Golden tick: Sendora-internal only — Business subscription active (or cancelled-until-expiry), not past_due.
 */
export async function resolveSenderIdentities(
  fromAddrs: string[]
): Promise<Map<string, SenderIdentity>> {
  const out = new Map<string, SenderIdentity>();
  if (fromAddrs.length === 0) return out;

  const parsed = fromAddrs.map((a) => ({
    raw: a,
    email: normalizeEmail(a),
  }));
  const emails = [...new Set(parsed.map((p) => p.email))];

  const db = getDb();
  const mailboxRows = await db
    .select({
      emailAddress: mailboxes.emailAddress,
      displayNameOverride: mailboxes.displayNameOverride,
      active: mailboxes.active,
      owner: users,
      bp: businessProfiles,
    })
    .from(mailboxes)
    .innerJoin(domains, eq(mailboxes.domainId, domains.id))
    .innerJoin(users, eq(domains.ownerUserId, users.id))
    .leftJoin(businessProfiles, eq(businessProfiles.userId, users.id))
    .where(inArray(mailboxes.emailAddress, emails));

  const byMailboxEmail = new Map<string, (typeof mailboxRows)[0]>();
  for (const r of mailboxRows) {
    byMailboxEmail.set(r.emailAddress.toLowerCase(), r);
  }
  const proRows = await db
    .select({
      p: professionalProfiles,
      owner: users,
      bp: businessProfiles,
    })
    .from(professionalProfiles)
    .innerJoin(users, eq(professionalProfiles.userId, users.id))
    .leftJoin(businessProfiles, eq(businessProfiles.userId, users.id))
    .where(inArray(professionalProfiles.emailAddress, emails));
  const byProEmail = new Map<string, (typeof proRows)[0]>();
  for (const r of proRows) {
    byProEmail.set(r.p.emailAddress.toLowerCase(), r);
  }

  const defaultDomain = getEmailDomain().toLowerCase();
  const localsNeeded = new Set<string>();
  for (const email of emails) {
    if (byMailboxEmail.has(email)) continue;
    const at = email.lastIndexOf("@");
    if (at < 0) continue;
    if (email.slice(at + 1) !== defaultDomain) continue;
    localsNeeded.add(email.slice(0, at).toLowerCase());
  }

  const byLocalPart = new Map<
    string,
    { u: typeof users.$inferSelect; bp: typeof businessProfiles.$inferSelect | null }
  >();
  if (localsNeeded.size > 0) {
    const lp = [...localsNeeded];
    const userRows = await db
      .select({ u: users, bp: businessProfiles })
      .from(users)
      .leftJoin(businessProfiles, eq(businessProfiles.userId, users.id))
      .where(inArray(users.localPart, lp));
    for (const r of userRows) {
      byLocalPart.set(r.u.localPart.toLowerCase(), {
        u: r.u,
        bp: r.bp,
      });
    }
  }

  for (const { raw, email } of parsed) {
    const displayFromHeader = raw.match(/^(.+)<[^>]+>/)?.[1]?.trim();

    const mb = byMailboxEmail.get(email);
    if (mb) {
      const displayFromOverride =
        mb.displayNameOverride?.trim() ||
        mb.bp?.displayNameDefault?.trim() ||
        mb.bp?.businessName?.trim();
      const displayName =
        displayFromOverride ||
        (displayFromHeader && displayFromHeader.replace(/^["']|["']$/g, "")) ||
        email.split("@")[0] ||
        email;

      const goldenTick =
        mb.active && shouldShowGoldenTick(mb.owner);

      out.set(raw, {
        email,
        displayName,
        goldenTick,
        businessName: mb.bp?.businessName?.trim() || null,
        logoUrl: mb.bp?.logoUrl ?? null,
        brandColor: mb.bp?.brandColor ?? null,
      });
      continue;
    }
    const pro = byProEmail.get(email);
    if (pro) {
      const displayName =
        pro.p.displayName?.trim() ||
        pro.bp?.displayNameDefault?.trim() ||
        pro.bp?.businessName?.trim() ||
        pro.p.handle;
      out.set(raw, {
        email,
        displayName,
        goldenTick: false,
        businessName: null,
        logoUrl: null,
        brandColor: null,
      });
      continue;
    }

    const at = email.lastIndexOf("@");
    if (at > 0 && email.slice(at + 1) === defaultDomain) {
      const local = email.slice(0, at).toLowerCase();
      const row = byLocalPart.get(local);
      if (row) {
        const bp = row.bp;
        const displayName =
          bp?.displayNameDefault?.trim() ||
          bp?.businessName?.trim() ||
          (displayFromHeader && displayFromHeader.replace(/^["']|["']$/g, "")) ||
          local;
        out.set(raw, {
          email,
          displayName,
          goldenTick: shouldShowGoldenTick(row.u),
          businessName: bp?.businessName?.trim() || null,
          logoUrl: bp?.logoUrl ?? null,
          brandColor: bp?.brandColor ?? null,
        });
        continue;
      }
    }

    const displayName =
      (displayFromHeader && displayFromHeader.replace(/^["']|["']$/g, "")) ||
      email.split("@")[0] ||
      email;
    out.set(raw, defaultIdentity(raw, email, displayName));
  }

  return out;
}

export async function resolveSingleSenderIdentity(
  fromAddr: string
): Promise<SenderIdentity | null> {
  const map = await resolveSenderIdentities([fromAddr]);
  return map.get(fromAddr) ?? null;
}
