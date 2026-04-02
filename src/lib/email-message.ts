import { randomUUID } from "crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  anonymousSendAliases,
  domains,
  mailboxes,
  messages,
  professionalProfiles,
  tempInboxAliases,
  tempInboxMessages,
  tempInboxUnclaimedMessages,
  users,
  type MessageFolder,
} from "@/db/schema";
import { getEmailDomain } from "@/lib/constants";
import {
  formatPostgresErrorForLog,
  isPostgresUndefinedColumnError,
  isPostgresUniqueViolation,
} from "@/lib/pg-error";
import {
  ensureMessagesOptionalColumns,
  resetMessagesOptionalColumnsCache,
} from "@/lib/message-schema-ensure";
import { logError, logInfo } from "./logger";
import { hasMessageAuthColumns } from "./message-auth-columns";
import { extractOtpCode } from "./temp-inbox";

export function normalizeMessageId(raw: string): string {
  const t = raw.trim();
  const inner = t.match(/<([^>]+)>/);
  return (inner ? inner[1] : t).toLowerCase();
}

/**
 * Stable, non-empty `provider_message_id` for DB unique (user_id, provider_message_id).
 * Empty normalized IDs would collide on repeated inbound mail without a Message-ID.
 */
export function stableProviderMessageIdForStorage(raw: string): string {
  const norm = normalizeMessageId(raw).trim();
  if (norm.length > 0) return norm.slice(0, 512);
  return `inbound-${randomUUID()}`;
}

/** Strip display name from `Name <addr@host>` for parsing. */
export function extractEmailAddress(raw: string): string {
  const m = /<([^>]+@[^>]+)>/.exec(raw.trim());
  if (m) return m[1].trim().toLowerCase();
  return raw.trim().toLowerCase();
}

export function parseRecipientLocalPart(
  recipient: string | undefined
): string | null {
  if (!recipient) return null;
  const addr = extractEmailAddress(recipient);
  const at = addr.indexOf("@");
  if (at <= 0) return null;
  return addr.slice(0, at).toLowerCase();
}

export function getInReplyToFromHeaders(
  headers: Record<string, string> | null | undefined
): string | null {
  if (!headers) return null;
  const entry = Object.entries(headers).find(
    ([k]) => k.toLowerCase() === "in-reply-to"
  );
  const v = entry?.[1];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function extractDomainFromEmailAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const addr = extractEmailAddress(raw);
  const at = addr.lastIndexOf("@");
  if (at < 0) return null;
  const domain = addr.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

function firstHeaderValue(
  headers: Record<string, string> | null | undefined,
  key: string
): string | null {
  if (!headers) return null;
  const entry = Object.entries(headers).find(
    ([k]) => k.toLowerCase() === key.toLowerCase()
  );
  const val = entry?.[1];
  return typeof val === "string" && val.trim() ? val.trim() : null;
}

export function deriveMailAuthMetadata(
  headers: Record<string, string> | null | undefined,
  fromAddr: string
): { mailedBy: string | null; signedBy: string | null } {
  const authResults = firstHeaderValue(headers, "Authentication-Results");
  const dkimSig = firstHeaderValue(headers, "DKIM-Signature");
  const returnPath = firstHeaderValue(headers, "Return-Path");

  let mailedBy =
    extractDomainFromEmailAddress(returnPath) ??
    (authResults?.match(/smtp\.mailfrom=([^\s;]+)/i)?.[1]?.toLowerCase() ?? null) ??
    extractDomainFromEmailAddress(fromAddr);

  if (mailedBy?.startsWith("<") && mailedBy.endsWith(">")) {
    mailedBy = mailedBy.slice(1, -1).trim().toLowerCase();
  }

  const signedFromDkimSig =
    dkimSig?.match(/(?:^|;\s*)d=([a-z0-9.-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase() ??
    null;
  const signedFromAuth =
    authResults?.match(/header\.d=([a-z0-9.-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase() ??
    null;
  const signedBy = signedFromDkimSig ?? signedFromAuth ?? null;

  return { mailedBy, signedBy };
}

export async function resolveInboundThreadId(
  userId: string,
  inReplyTo: string | null
): Promise<string> {
  if (!inReplyTo) return randomUUID();
  const needle = normalizeMessageId(inReplyTo);
  const rows = await getDb()
    .select({ threadId: messages.threadId })
    .from(messages)
    .where(
      and(
        eq(messages.userId, userId),
        sql`lower(trim(both from coalesce(${messages.providerMessageId}, ''))) = ${needle}`
      )
    )
    .limit(1);
  if (rows.length > 0) return rows[0].threadId;
  return randomUUID();
}

export async function persistSentMessage(params: {
  userId: string;
  providerMessageId: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  fromAddr: string;
  toAddr: string;
  ccAddr?: string;
  bccAddr?: string;
  threadId?: string;
  hasAttachment?: boolean;
  sentAnonymously?: boolean;
}): Promise<string> {
  const snippet =
    params.bodyText.length > 160
      ? `${params.bodyText.slice(0, 157)}...`
      : params.bodyText;
  const threadId = params.threadId ?? randomUUID();
  const normPid = stableProviderMessageIdForStorage(params.providerMessageId);
  await ensureMessagesOptionalColumns();

  const doInsert = () =>
    getDb()
      .insert(messages)
      .values({
        userId: params.userId,
        folder: "sent",
        providerMessageId: normPid,
        subject: params.subject,
        snippet,
        bodyText: params.bodyText,
        bodyHtml: params.bodyHtml,
        fromAddr: params.fromAddr,
        toAddr: params.toAddr,
        ccAddr: params.ccAddr ?? "",
        bccAddr: params.bccAddr ?? "",
        readAt: new Date(),
        threadId,
        hasAttachment: params.hasAttachment ?? false,
        sentAnonymously: params.sentAnonymously ?? false,
      })
      .returning({ id: messages.id });

  try {
    const [row] = await doInsert();
    return row.id;
  } catch (e) {
    if (!isPostgresUndefinedColumnError(e)) throw e;
    resetMessagesOptionalColumnsCache();
    await ensureMessagesOptionalColumns();
    const [row] = await doInsert();
    return row.id;
  }
}

export async function ingestInboundMessage(params: {
  providerMessageId: string;
  userId: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  fromAddr: string;
  toAddr: string;
  inReplyTo?: string | null;
  ccAddr?: string;
  threadId: string;
  hasAttachment?: boolean;
  folder?: MessageFolder;
  mailedBy?: string | null;
  signedBy?: string | null;
}): Promise<{ id: string; created: boolean; tempInbox: boolean }> {
  // If the email is addressed to a user's temporary inbox alias,
  // store it in the temp inbox tables (private + OTP focused).
  const now = new Date();
  const alias = await getDb()
    .select({
      id: tempInboxAliases.id,
      expiresAt: tempInboxAliases.expiresAt,
    })
    .from(tempInboxAliases)
    .where(
      and(
        eq(tempInboxAliases.userId, params.userId),
        eq(tempInboxAliases.emailAddress, params.toAddr),
        gt(tempInboxAliases.expiresAt, now)
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (alias) {
    const snippet =
      params.bodyText.length > 160
        ? `${params.bodyText.slice(0, 157)}...`
        : params.bodyText;
    const otp = extractOtpCode(`${params.subject}\n${params.bodyText}`);
    const providerNormId = stableProviderMessageIdForStorage(params.providerMessageId);

    try {
      const inserted = await getDb()
        .insert(tempInboxMessages)
        .values({
          userId: params.userId,
          aliasId: alias.id,
          providerMessageId: providerNormId,
          receivedAt: now,
          expiresAt: alias.expiresAt,
          fromAddr: params.fromAddr,
          subject: params.subject,
          otpCode: otp ?? null,
          otpMatchedAt: otp ? now : null,
          snippet,
          createdAt: now,
        })
        .returning({ id: tempInboxMessages.id });
      logInfo("temp_inbox_stored", { userId: params.userId });
      return { id: inserted[0].id, created: true, tempInbox: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      if (
        isPostgresUniqueViolation(e) ||
        msg.includes("unique") ||
        msg.includes("duplicate")
      ) {
        const existing = await getDb()
          .select({ id: tempInboxMessages.id })
          .from(tempInboxMessages)
          .where(
            and(
              eq(tempInboxMessages.userId, params.userId),
              sql`lower(trim(both from coalesce(${tempInboxMessages.providerMessageId}, ''))) = ${providerNormId}`
            )
          )
          .limit(1);
        if (existing.length > 0) {
          return { id: existing[0].id, created: false, tempInbox: true };
        }
      }
      logError("temp_inbox_insert_failed", {
        message: formatPostgresErrorForLog(e),
        userId: params.userId,
      });
      throw e;
    }
  }

  const snippet =
    params.bodyText.length > 160
      ? `${params.bodyText.slice(0, 157)}...`
      : params.bodyText;
  const normId = stableProviderMessageIdForStorage(params.providerMessageId);
  const includeAuthCols = await hasMessageAuthColumns();

  await ensureMessagesOptionalColumns();

  const insertInbound = async (useAuthCols: boolean) =>
    getDb()
      .insert(messages)
      .values({
        userId: params.userId,
        folder: params.folder ?? "inbox",
        providerMessageId: normId,
        subject: params.subject,
        snippet,
        bodyText: params.bodyText ?? "",
        bodyHtml: params.bodyHtml,
        fromAddr: params.fromAddr,
        toAddr: params.toAddr,
        ccAddr: params.ccAddr ?? "",
        bccAddr: "",
        threadId: params.threadId,
        inReplyTo: params.inReplyTo
          ? normalizeMessageId(params.inReplyTo).slice(0, 1024)
          : null,
        ...(useAuthCols
          ? {
              mailedBy: params.mailedBy ?? null,
              signedBy: params.signedBy ?? null,
            }
          : {}),
        hasAttachment: params.hasAttachment ?? false,
      })
      .returning({ id: messages.id });

  try {
    let inserted;
    try {
      inserted = await insertInbound(includeAuthCols);
    } catch (firstErr) {
      if (isPostgresUndefinedColumnError(firstErr)) {
        resetMessagesOptionalColumnsCache();
        await ensureMessagesOptionalColumns();
        try {
          inserted = await insertInbound(includeAuthCols);
        } catch (secondErr) {
          if (includeAuthCols && isPostgresUndefinedColumnError(secondErr)) {
            inserted = await insertInbound(false);
          } else {
            throw secondErr;
          }
        }
      } else {
        throw firstErr;
      }
    }
    logInfo("inbound_stored", { userId: params.userId });
    return { id: inserted[0].id, created: true, tempInbox: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    const duplicate =
      isPostgresUniqueViolation(e) ||
      msg.includes("unique") ||
      msg.includes("duplicate");
    if (duplicate) {
      logInfo("inbound_duplicate_skipped", {
        providerMessageId: params.providerMessageId,
      });
      const existing = await getDb()
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.userId, params.userId),
            sql`lower(trim(both from coalesce(${messages.providerMessageId}, ''))) = ${normId}`
          )
        )
        .limit(1);
      if (existing.length > 0)
        return { id: existing[0].id, created: false, tempInbox: false };
    }
    logError("inbound_insert_failed", {
      message: formatPostgresErrorForLog(e),
      userId: params.userId,
    });
    throw e;
  }
}

/** Resolve Sendora user id for internal delivery (default domain or verified mailbox address). */
export async function resolveInternalRecipientUserId(
  toAddr: string
): Promise<string | null> {
  const addr = extractEmailAddress(toAddr);
  const domain = getEmailDomain().toLowerCase();
  const at = addr.lastIndexOf("@");
  if (at < 0) return null;
  const recipDomain = addr.slice(at + 1).toLowerCase();
  const localPart = addr.slice(0, at).toLowerCase();

  // Temporary inbox aliases are private and should map to the owning user.
  const tempAlias = await getDb()
    .select({ userId: tempInboxAliases.userId })
    .from(tempInboxAliases)
    .where(
      and(
        eq(tempInboxAliases.emailAddress, addr),
        gt(tempInboxAliases.expiresAt, new Date())
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (tempAlias?.userId) return tempAlias.userId;

  if (recipDomain === domain) {
    const anonRow = await getDb()
      .select({ userId: anonymousSendAliases.userId })
      .from(anonymousSendAliases)
      .where(eq(anonymousSendAliases.aliasLocalPart, localPart))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (anonRow?.userId) return anonRow.userId;

    const rows = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.localPart, localPart))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  const rows = await getDb()
    .select({ userId: domains.ownerUserId })
    .from(mailboxes)
    .innerJoin(domains, eq(mailboxes.domainId, domains.id))
    .where(
      and(
        eq(mailboxes.emailAddress, addr),
        eq(mailboxes.active, true),
        eq(domains.verificationStatus, "verified"),
        eq(domains.operationalStatus, "active")
      )
    )
    .limit(1);
  if (rows[0]?.userId) return rows[0].userId;

  const proRows = await getDb()
    .select({ userId: professionalProfiles.userId })
    .from(professionalProfiles)
    .where(eq(professionalProfiles.emailAddress, addr))
    .limit(1);

  return proRows[0]?.userId ?? null;
}

function unclaimedExpiryMinutes(): number {
  const raw = process.env.TEMP_INBOX_UNCLAIMED_EXPIRY_MINUTES ?? "10";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

export async function storeUnclaimedTempInboxMessage(params: {
  emailAddress: string;
  providerMessageId: string;
  fromAddr: string;
  subject: string;
  bodyText: string;
}): Promise<void> {
  const now = new Date();
  const otp = extractOtpCode(`${params.subject}\n${params.bodyText}`);
  const snippet =
    params.bodyText.length > 160
      ? `${params.bodyText.slice(0, 157)}...`
      : params.bodyText;
  const providerNormId = normalizeMessageId(params.providerMessageId);
  const expiresAt = new Date(now.getTime() + unclaimedExpiryMinutes() * 60 * 1000);

  try {
    await getDb().insert(tempInboxUnclaimedMessages).values({
      emailAddress: params.emailAddress,
      providerMessageId: providerNormId.slice(0, 512),
      receivedAt: now,
      expiresAt,
      fromAddr: params.fromAddr,
      subject: params.subject,
      otpCode: otp ?? null,
      otpMatchedAt: otp ? now : null,
      snippet,
      createdAt: now,
    });
  } catch (e) {
    // Dedup: if already stored, ignore.
    const msg = e instanceof Error ? e.message : "unknown";
    if (msg.includes("unique") || msg.includes("duplicate")) return;
    throw e;
  }
}
