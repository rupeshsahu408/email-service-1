import { and, count, eq, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attachments, messages, users } from "@/db/schema";
import { recordAdminActivity } from "@/lib/admin-activity";
import { deleteAttachmentFile } from "@/lib/attachments-storage";
import {
  mailboxMessageContentBytesExpr,
  STORAGE_WARN_RATIO_80,
  STORAGE_WARN_RATIO_95,
} from "@/lib/storage-quota";
import { getAdminSystemSettings } from "@/lib/admin-system-settings";

export type AdminCleanupAction =
  | "empty_all_trash"
  | "delete_deleted_messages"
  | "clean_old_sent";

export type AdminStorageOverview = {
  totalCapacityBytes: number;
  totalUsedBytes: number;
  totalFreeBytes: number;
  usagePercent: number;
  warningState: "ok" | "warning80" | "warning95" | "full";
  breakdown: {
    inboxBytes: number;
    sentBytes: number;
    trashBytes: number;
    attachmentBytes: number;
  };
  topUsers: Array<{
    userId: string;
    email: string;
    usedBytes: number;
  }>;
};

export type AdminCleanupPreview = {
  action: AdminCleanupAction;
  days?: number;
  affectedUsers: number;
  affectedMessages: number;
  estimatedRecoverableBytes: number;
};

function toNumber(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function firstRowValue(
  rows: Array<Record<string, unknown>>,
  key: string
): unknown {
  return rows[0]?.[key];
}

function cleanupWhere(action: AdminCleanupAction, days?: number) {
  if (action === "empty_all_trash") {
    return eq(messages.folder, "trash");
  }
  if (action === "clean_old_sent") {
    const d = Math.max(1, days ?? 30);
    const cutoff = new Date(Date.now() - d * 24 * 60 * 60 * 1000);
    return and(eq(messages.folder, "sent"), lte(messages.createdAt, cutoff));
  }
  return sql`exists (
    select 1 from ${users} u
    where u.id = ${messages.userId}
      and u.deleted_at is not null
  )`;
}

function usageState(
  used: number,
  capacity: number,
  warningThresholdPercent: number
): AdminStorageOverview["warningState"] {
  if (capacity <= 0) return "ok";
  if (used >= capacity) return "full";
  const ratio = used / capacity;
  if (ratio >= STORAGE_WARN_RATIO_95) return "warning95";
  if (ratio >= Math.max(STORAGE_WARN_RATIO_80, warningThresholdPercent / 100)) return "warning80";
  return "ok";
}

export async function getAdminStorageOverview(): Promise<AdminStorageOverview> {
  const db = getDb();
  const [
    capacityRow,
    mailboxContentRow,
    mailboxAttachmentRow,
    composeDraftRow,
    composeAttachmentRow,
    scheduledTextRow,
    scheduledAttachmentRow,
    confidentialRow,
    tempInboxRow,
    inboxRow,
    sentRow,
    trashRow,
    topUsersRows,
  ] = await Promise.all([
    db
      .select({
        bytes: sql<number>`coalesce(sum(${users.storageQuotaBytes}), 0)::bigint`,
      })
      .from(users),
    db
      .select({
        bytes: sql<number>`coalesce(sum(${mailboxMessageContentBytesExpr(messages)}), 0)::bigint`,
      })
      .from(messages),
    db
      .select({
        bytes: sql<number>`coalesce(sum(${attachments.sizeBytes}), 0)::bigint`,
      })
      .from(attachments),
    db.execute(sql`
      select coalesce(sum(
        octet_length(cd.to_addr)
        + octet_length(cd.cc_addr)
        + octet_length(cd.bcc_addr)
        + octet_length(cd.subject)
        + octet_length(cd.body_text)
        + octet_length(cd.body_html)
      ), 0)::bigint as bytes
      from compose_drafts cd
    `),
    db.execute(sql`
      select coalesce(sum(ca.size_bytes), 0)::bigint as bytes
      from compose_attachments ca
    `),
    db.execute(sql`
      select coalesce(sum(
        octet_length(se.to_addr)
        + octet_length(se.cc_addr)
        + octet_length(se.bcc_addr)
        + octet_length(se.subject)
        + octet_length(se.body_text)
        + octet_length(se.body_html)
        + octet_length(coalesce(se.mailbox_id, ''))
      ), 0)::bigint as bytes
      from scheduled_emails se
      where se.status <> 'sent'
    `),
    db.execute(sql`
      select coalesce(sum(sea.size_bytes), 0)::bigint as bytes
      from scheduled_email_attachments sea
      inner join scheduled_emails se on se.id = sea.scheduled_email_id
      where se.status <> 'sent'
    `),
    db.execute(sql`
      select coalesce(sum(
        octet_length(cm.subject)
        + octet_length(cm.body_text)
        + octet_length(cm.body_html)
      ), 0)::bigint as bytes
      from confidential_messages cm
    `),
    db.execute(sql`
      select coalesce(sum(
        octet_length(tim.from_addr)
        + octet_length(tim.subject)
        + octet_length(tim.snippet)
      ), 0)::bigint as bytes
      from temp_inbox_messages tim
    `),
    db
      .select({
        bytes: sql<number>`coalesce(sum(${mailboxMessageContentBytesExpr(messages)}), 0)::bigint
          + coalesce(sum((select coalesce(sum(a.size_bytes), 0)::bigint from attachments a where a.message_id = ${messages.id})), 0)::bigint`,
      })
      .from(messages)
      .where(eq(messages.folder, "inbox")),
    db
      .select({
        bytes: sql<number>`coalesce(sum(${mailboxMessageContentBytesExpr(messages)}), 0)::bigint
          + coalesce(sum((select coalesce(sum(a.size_bytes), 0)::bigint from attachments a where a.message_id = ${messages.id})), 0)::bigint`,
      })
      .from(messages)
      .where(eq(messages.folder, "sent")),
    db
      .select({
        bytes: sql<number>`coalesce(sum(${mailboxMessageContentBytesExpr(messages)}), 0)::bigint
          + coalesce(sum((select coalesce(sum(a.size_bytes), 0)::bigint from attachments a where a.message_id = ${messages.id})), 0)::bigint`,
      })
      .from(messages)
      .where(eq(messages.folder, "trash")),
    db.execute(sql`
      select
        u.id as user_id,
        u.local_part as local_part,
        coalesce(sum(
          octet_length(m.subject)
          + octet_length(m.snippet)
          + octet_length(m.body_text)
          + octet_length(coalesce(m.body_html, ''))
          + octet_length(m.from_addr)
          + octet_length(m.to_addr)
          + octet_length(m.cc_addr)
          + octet_length(m.bcc_addr)
          + octet_length(coalesce(m.in_reply_to, ''))
          + octet_length(coalesce(m.mailed_by, ''))
          + octet_length(coalesce(m.signed_by, ''))
          + octet_length(coalesce(m.provider_message_id, ''))
        ), 0)::bigint
        + coalesce(sum((select coalesce(sum(a.size_bytes), 0)::bigint from attachments a where a.message_id = m.id)), 0)::bigint
        as used_bytes
      from users u
      left join messages m on m.user_id = u.id
      group by u.id, u.local_part
      order by used_bytes desc
      limit 5
    `),
  ]);

  const totalCapacityBytes = toNumber(capacityRow[0]?.bytes);
  const settings = await getAdminSystemSettings();
  const configuredCapacity = settings.storage.totalStorageLimitBytes;
  const effectiveCapacity = configuredCapacity > 0 ? configuredCapacity : totalCapacityBytes;
  const composeDraftBytes = toNumber(
    firstRowValue(composeDraftRow as unknown as Array<Record<string, unknown>>, "bytes")
  );
  const scheduledTextBytes = toNumber(
    firstRowValue(scheduledTextRow as unknown as Array<Record<string, unknown>>, "bytes")
  );
  const scheduledAttachmentBytes = toNumber(
    firstRowValue(scheduledAttachmentRow as unknown as Array<Record<string, unknown>>, "bytes")
  );
  const confidentialBytes = toNumber(
    firstRowValue(confidentialRow as unknown as Array<Record<string, unknown>>, "bytes")
  );
  const tempInboxBytes = toNumber(
    firstRowValue(tempInboxRow as unknown as Array<Record<string, unknown>>, "bytes")
  );

  const totalUsedBytes =
    toNumber(mailboxContentRow[0]?.bytes) +
    toNumber(mailboxAttachmentRow[0]?.bytes) +
    composeDraftBytes +
    toNumber(composeAttachmentRow[0]?.bytes) +
    scheduledTextBytes +
    scheduledAttachmentBytes +
    confidentialBytes +
    tempInboxBytes;
  const totalFreeBytes = Math.max(effectiveCapacity - totalUsedBytes, 0);
  const usagePercent =
    effectiveCapacity > 0 ? Math.round((totalUsedBytes / effectiveCapacity) * 1000) / 10 : 0;

  const topUsers = (topUsersRows as unknown as Array<Record<string, unknown>>).map((row) => ({
    userId: String(row.user_id ?? ""),
    email: `${String(row.local_part ?? "")}@sendora.com`,
    usedBytes: toNumber(row.used_bytes),
  }));

  return {
    totalCapacityBytes: effectiveCapacity,
    totalUsedBytes,
    totalFreeBytes,
    usagePercent,
    warningState: usageState(
      totalUsedBytes,
      effectiveCapacity,
      settings.storage.warningThresholdPercent
    ),
    breakdown: {
      inboxBytes: toNumber(inboxRow[0]?.bytes),
      sentBytes: toNumber(sentRow[0]?.bytes),
      trashBytes: toNumber(trashRow[0]?.bytes),
      attachmentBytes: toNumber(mailboxAttachmentRow[0]?.bytes) + toNumber(composeAttachmentRow[0]?.bytes),
    },
    topUsers,
  };
}

export async function getAdminCleanupPreview(
  action: AdminCleanupAction,
  days?: number
): Promise<AdminCleanupPreview> {
  const db = getDb();
  const whereClause = cleanupWhere(action, days);
  const [messagesRow, usersRow, bytesRow] = await Promise.all([
    db.select({ c: count() }).from(messages).where(whereClause),
    db
      .select({
        c: sql<number>`count(distinct ${messages.userId})::int`,
      })
      .from(messages)
      .where(whereClause),
    db
      .select({
        contentBytes: sql<number>`coalesce(sum(${mailboxMessageContentBytesExpr(messages)}), 0)::bigint`,
      })
      .from(messages)
      .where(whereClause),
  ]);

  const msgCount = toNumber(messagesRow[0]?.c);
  const userCount = toNumber(usersRow[0]?.c);
  const contentBytes = toNumber(bytesRow[0]?.contentBytes);

  let attachmentBytes = 0;
  if (msgCount > 0) {
    const [attachmentRow] = await db
      .select({
        bytes: sql<number>`coalesce(sum(${attachments.sizeBytes}), 0)::bigint`,
      })
      .from(attachments)
      .innerJoin(messages, eq(attachments.messageId, messages.id))
      .where(whereClause);
    attachmentBytes = toNumber(attachmentRow?.bytes);
  }

  return {
    action,
    days,
    affectedUsers: userCount,
    affectedMessages: msgCount,
    estimatedRecoverableBytes: contentBytes + attachmentBytes,
  };
}

export async function runAdminCleanup(input: {
  actorUserId: string;
  action: AdminCleanupAction;
  days?: number;
}): Promise<AdminCleanupPreview> {
  const db = getDb();
  const preview = await getAdminCleanupPreview(input.action, input.days);
  if (preview.affectedMessages === 0) {
    await recordAdminActivity({
      eventType: "admin_storage_cleanup_noop",
      severity: "info",
      actorUserId: input.actorUserId,
      detail: `No messages eligible for ${input.action}.`,
      meta: { action: input.action, days: input.days ?? null },
    });
    return preview;
  }

  const whereClause = cleanupWhere(input.action, input.days);
  let deletedMessages = 0;
  const batchSize = 300;

  while (true) {
    const ids = await db
      .select({ id: messages.id })
      .from(messages)
      .where(whereClause)
      .limit(batchSize);
    if (ids.length === 0) break;
    const messageIds = ids.map((r) => r.id);
    const attRows = await db
      .select({ storageKey: attachments.storageKey })
      .from(attachments)
      .where(inArray(attachments.messageId, messageIds));

    await db.delete(messages).where(inArray(messages.id, messageIds));
    deletedMessages += messageIds.length;

    await Promise.all(
      attRows.map((r) =>
        deleteAttachmentFile(r.storageKey).catch(() => {
          return undefined;
        })
      )
    );
  }

  await recordAdminActivity({
    eventType: "admin_storage_cleanup_run",
    severity: "warning",
    actorUserId: input.actorUserId,
    detail: `Ran ${input.action}; deleted ${deletedMessages} messages.`,
    meta: {
      action: input.action,
      days: input.days ?? null,
      deletedMessages,
      affectedUsers: preview.affectedUsers,
      estimatedRecoverableBytes: preview.estimatedRecoverableBytes,
    },
  });

  return {
    ...preview,
    affectedMessages: deletedMessages,
  };
}
