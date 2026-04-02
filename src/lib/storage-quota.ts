/**
 * Phase 1 storage accounting — single source of truth for per-user byte usage and plan limits.
 *
 * Counting policy (PostgreSQL UTF-8 `octet_length` on text/varchar + integer `size_bytes` for blobs):
 * - **messages** (all folders: inbox, sent, spam, trash, archive): subject, snippet, body, addresses,
 *   and optional metadata strings. Snippet overlaps body semantically but is stored separately; we
 *   count both for a stable DB-oriented total. Trash counts until the message row is hard-deleted.
 * - **attachments** (mailbox): sum of `size_bytes` for files tied to the user's messages.
 * - **compose_drafts** / **compose_attachments**: active compose buffer (one draft row per user).
 * - **scheduled_emails** (status ≠ `'sent'`) + **scheduled_email_attachments**: queued/cancelled/etc.
 *   snapshots. Rows with `sent` are excluded — body already lives in **messages** after send.
 * - **confidential_messages**: secure-link payload (not in **messages**).
 * - **temp_inbox_messages**: OTP temp inbox text for the user.
 *
 * Not counted: confidential_otps, temp_inbox_unclaimed_messages, labels, avatars, settings, etc.
 *
 * Phase 2+: warning thresholds and attachment enforcement use `getStorageUsageLevel` /
 * `getStorageThresholdState` — always derive from `getUserStorageSnapshot`, never duplicate sums.
 */

import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attachments,
  composeAttachments,
  composeDrafts,
  confidentialMessages,
  messages,
  scheduledEmailAttachments,
  scheduledEmails,
  tempInboxMessages,
  users,
} from "@/db/schema";
import {
  getEffectivePlan,
  type EffectivePlan,
} from "@/lib/plan";

export type DbClient = ReturnType<typeof getDb>;

const GIB = 1024 ** 3;

/** Free tier storage cap (10 GiB). */
export const STORAGE_LIMIT_BYTES_FREE = 10 * GIB;

/** Business tier storage cap (200 GiB). */
export const STORAGE_LIMIT_BYTES_BUSINESS = 200 * GIB;

/** Warn when used / limit is at or above this ratio (80%). */
export const STORAGE_WARN_RATIO_80 = 0.8;

/** Stronger warn when at or above this ratio (95%). */
export const STORAGE_WARN_RATIO_95 = 0.95;

export const STORAGE_MESSAGE_LOW = "You are running low on storage.";

export const STORAGE_MESSAGE_ALMOST_FULL = "Your storage is almost full.";

export const STORAGE_MESSAGE_FULL =
  "Your storage is full. Delete files or upgrade your plan.";

/** API / client error payload when attachment-related operations are blocked. */
export const STORAGE_ERROR_CODE = "STORAGE_FULL" as const;

export type StorageUsageLevel = "ok" | "warning80" | "warning95" | "full";

export function getStorageUsageRatio(
  usedBytes: number,
  limitBytes: number
): number {
  if (!Number.isFinite(limitBytes) || limitBytes <= 0) return 0;
  return usedBytes / limitBytes;
}

/**
 * Derives discrete UI/enforcement level from bytes used vs plan limit.
 * At exactly 100% (used >= limit): `full` — Phase 2 blocks new attachment bytes.
 */
export function getStorageUsageLevel(
  usedBytes: number,
  limitBytes: number
): StorageUsageLevel {
  if (!Number.isFinite(limitBytes) || limitBytes <= 0) return "ok";
  if (usedBytes >= limitBytes) return "full";
  const r = usedBytes / limitBytes;
  if (r >= STORAGE_WARN_RATIO_95) return "warning95";
  if (r >= STORAGE_WARN_RATIO_80) return "warning80";
  return "ok";
}

export function getStorageUserMessage(level: StorageUsageLevel): string | null {
  switch (level) {
    case "warning80":
      return STORAGE_MESSAGE_LOW;
    case "warning95":
      return STORAGE_MESSAGE_ALMOST_FULL;
    case "full":
      return STORAGE_MESSAGE_FULL;
    default:
      return null;
  }
}

export type StorageThresholdState = {
  level: StorageUsageLevel;
  /** usedBytes / limitBytes, 0 if limit is 0 */
  usageRatio: number;
  /** User-facing copy for banners; null when `level` is `ok` */
  message: string | null;
};

export function storageLimitBytesForPlan(plan: EffectivePlan): number {
  return plan === "business" ? STORAGE_LIMIT_BYTES_BUSINESS : STORAGE_LIMIT_BYTES_FREE;
}

export function getStorageLimitBytes(
  user: Pick<
    typeof users.$inferSelect,
    "plan" | "planExpiresAt" | "planStatus" | "storageQuotaBytes"
  >
): number {
  const planLimit = storageLimitBytesForPlan(getEffectivePlan(user));
  const userQuota = Number(user.storageQuotaBytes ?? 0);
  if (!Number.isFinite(userQuota) || userQuota <= 0) return planLimit;
  return Math.min(planLimit, userQuota);
}

export type UserStorageBreakdown = {
  mailboxContentBytes: number;
  mailboxAttachmentBytes: number;
  composeDraftBytes: number;
  composeAttachmentBytes: number;
  scheduledPendingBytes: number;
  confidentialBytes: number;
  tempInboxBytes: number;
};

export type UserStorageComputation = {
  usedBytes: number;
  messageCount: number;
  breakdown: UserStorageBreakdown;
};

export type UserStorageSnapshot = UserStorageComputation & {
  effectivePlan: EffectivePlan;
  limitBytes: number;
  remainingBytes: number;
};

export function getStorageThresholdState(
  snapshot: Pick<UserStorageSnapshot, "usedBytes" | "limitBytes">
): StorageThresholdState {
  const usageRatio = getStorageUsageRatio(
    snapshot.usedBytes,
    snapshot.limitBytes
  );
  const level = getStorageUsageLevel(
    snapshot.usedBytes,
    snapshot.limitBytes
  );
  return {
    level,
    usageRatio,
    message: getStorageUserMessage(level),
  };
}

/** True when no additional attachment bytes should be accepted (used >= limit). */
export function isStorageFull(
  snapshot: Pick<UserStorageSnapshot, "usedBytes" | "limitBytes">
): boolean {
  return (
    Number.isFinite(snapshot.limitBytes) &&
    snapshot.limitBytes > 0 &&
    snapshot.usedBytes >= snapshot.limitBytes
  );
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Aggregates all Phase 1 storage contributors for a user. Prefer importing this or
 * `getUserStorageSnapshot` from API routes and future upload gates — not ad-hoc SQL.
 */
export async function computeUserStorageUsedBytes(
  db: DbClient,
  userId: string
): Promise<UserStorageComputation> {
  const [
    mailboxRow,
    mailboxAttRow,
    draftRow,
    composeAttRow,
    scheduledTextRow,
    scheduledAttRow,
    confidentialRow,
    tempInboxRow,
  ] = await Promise.all([
    db
      .select({
        contentBytes: sql<number>`coalesce(sum(${mailboxMessageContentBytesExpr(messages)}), 0)::bigint`,
        messageCount: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(eq(messages.userId, userId)),

    db
      .select({
        bytes: sql<number>`coalesce(sum(${attachments.sizeBytes}), 0)::bigint`,
      })
      .from(attachments)
      .innerJoin(messages, eq(attachments.messageId, messages.id))
      .where(eq(messages.userId, userId)),

    db
      .select({
        bytes: sql<number>`coalesce(sum(
          octet_length(${composeDrafts.toAddr})
          + octet_length(${composeDrafts.ccAddr})
          + octet_length(${composeDrafts.bccAddr})
          + octet_length(${composeDrafts.subject})
          + octet_length(${composeDrafts.bodyText})
          + octet_length(${composeDrafts.bodyHtml})
        ), 0)::bigint`,
      })
      .from(composeDrafts)
      .where(eq(composeDrafts.userId, userId)),

    db
      .select({
        bytes: sql<number>`coalesce(sum(${composeAttachments.sizeBytes}), 0)::bigint`,
      })
      .from(composeAttachments)
      .where(eq(composeAttachments.userId, userId)),

    db
      .select({
        textBytes: sql<number>`coalesce(sum(
          octet_length(${scheduledEmails.toAddr})
          + octet_length(${scheduledEmails.ccAddr})
          + octet_length(${scheduledEmails.bccAddr})
          + octet_length(${scheduledEmails.subject})
          + octet_length(${scheduledEmails.bodyText})
          + octet_length(${scheduledEmails.bodyHtml})
          + octet_length(coalesce(${scheduledEmails.mailboxId}, ''))
        ), 0)::bigint`,
      })
      .from(scheduledEmails)
      .where(
        and(eq(scheduledEmails.userId, userId), ne(scheduledEmails.status, "sent"))
      ),

    db
      .select({
        attachmentBytes: sql<number>`coalesce(sum(${scheduledEmailAttachments.sizeBytes}), 0)::bigint`,
      })
      .from(scheduledEmailAttachments)
      .innerJoin(
        scheduledEmails,
        eq(scheduledEmailAttachments.scheduledEmailId, scheduledEmails.id)
      )
      .where(
        and(
          eq(scheduledEmails.userId, userId),
          ne(scheduledEmails.status, "sent")
        )
      ),

    db
      .select({
        bytes: sql<number>`coalesce(sum(
          octet_length(${confidentialMessages.subject})
          + octet_length(${confidentialMessages.bodyText})
          + octet_length(${confidentialMessages.bodyHtml})
        ), 0)::bigint`,
      })
      .from(confidentialMessages)
      .where(eq(confidentialMessages.ownerUserId, userId)),

    db
      .select({
        bytes: sql<number>`coalesce(sum(
          octet_length(${tempInboxMessages.fromAddr})
          + octet_length(${tempInboxMessages.subject})
          + octet_length(${tempInboxMessages.snippet})
        ), 0)::bigint`,
      })
      .from(tempInboxMessages)
      .where(eq(tempInboxMessages.userId, userId)),
  ]);

  const mailboxContentBytes = num(mailboxRow[0]?.contentBytes);
  const messageCount = num(mailboxRow[0]?.messageCount);
  const mailboxAttachmentBytes = num(mailboxAttRow[0]?.bytes);
  const composeDraftBytes = num(draftRow[0]?.bytes);
  const composeAttachmentBytes = num(composeAttRow[0]?.bytes);
  const scheduledTextBytes = num(scheduledTextRow[0]?.textBytes);
  const scheduledAttachmentBytes = num(scheduledAttRow[0]?.attachmentBytes);
  const scheduledPendingBytes = scheduledTextBytes + scheduledAttachmentBytes;
  const confidentialBytes = num(confidentialRow[0]?.bytes);
  const tempInboxBytes = num(tempInboxRow[0]?.bytes);

  const breakdown: UserStorageBreakdown = {
    mailboxContentBytes,
    mailboxAttachmentBytes,
    composeDraftBytes,
    composeAttachmentBytes,
    scheduledPendingBytes,
    confidentialBytes,
    tempInboxBytes,
  };

  const usedBytes =
    mailboxContentBytes +
    mailboxAttachmentBytes +
    composeDraftBytes +
    composeAttachmentBytes +
    scheduledPendingBytes +
    confidentialBytes +
    tempInboxBytes;

  return { usedBytes, messageCount, breakdown };
}

/**
 * Storage byte expression for message "content" as used in Phase 1.
 * Excludes attachments (handled separately via `attachments.sizeBytes`).
 */
export function mailboxMessageContentBytesExpr(m: typeof messages) {
  return sql<number>`
    octet_length(${m.subject})
    + octet_length(${m.snippet})
    + octet_length(${m.bodyText})
    + octet_length(coalesce(${m.bodyHtml}, ''))
    + octet_length(${m.fromAddr})
    + octet_length(${m.toAddr})
    + octet_length(${m.ccAddr})
    + octet_length(${m.bccAddr})
    + octet_length(coalesce(${m.inReplyTo}, ''))
    + octet_length(coalesce(${m.mailedBy}, ''))
    + octet_length(coalesce(${m.signedBy}, ''))
    + octet_length(coalesce(${m.providerMessageId}, ''))
  `;
}

/**
 * Loads plan fields from DB then delegates to `getUserStorageSnapshot` — for routes that only have `userId`.
 */
export async function getUserStorageSnapshotByUserId(
  db: DbClient,
  userId: string
): Promise<UserStorageSnapshot | null> {
  const [u] = await db
    .select({
      id: users.id,
      plan: users.plan,
      planExpiresAt: users.planExpiresAt,
      planStatus: users.planStatus,
      storageQuotaBytes: users.storageQuotaBytes,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return null;
  return getUserStorageSnapshot(db, u);
}

export async function getUserStorageSnapshot(
  db: DbClient,
  user: Pick<
    typeof users.$inferSelect,
    "id" | "plan" | "planExpiresAt" | "planStatus" | "storageQuotaBytes"
  >
): Promise<UserStorageSnapshot> {
  const effectivePlan = getEffectivePlan(user);
  const limitBytes = getStorageLimitBytes(user);
  const { usedBytes, messageCount, breakdown } =
    await computeUserStorageUsedBytes(db, user.id);
  return {
    effectivePlan,
    limitBytes,
    usedBytes,
    remainingBytes: limitBytes - usedBytes,
    messageCount,
    breakdown,
  };
}
