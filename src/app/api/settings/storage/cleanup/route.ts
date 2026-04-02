import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attachments, composeAttachments, composeDrafts, messages } from "@/db/schema";
import { getAuthContext } from "@/lib/session";
import {
  getStorageThresholdState,
  getUserStorageSnapshot,
  mailboxMessageContentBytesExpr,
} from "@/lib/storage-quota";

const NEARING_DAYS = 7;
const LARGE_ATTACHMENT_MIN_BYTES = 5 * 1024 * 1024; // 5 MiB

type CleanupMessageRow = {
  id: string;
  subject: string;
  trashMovedAt: string | null;
  trashDeleteAfterAt: string | null;
  messageBytes: number;
  attachmentBytes: number;
  totalBytes: number;
  attachmentCount: number;
  topAttachmentFilename: string | null;
  topAttachmentSizeBytes: number | null;
};

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const userId = ctx.user.id;

  const storageSnap = await getUserStorageSnapshot(db, ctx.user);
  const threshold = getStorageThresholdState(storageSnap);

  const now = new Date();
  const nearDelete = new Date(now.getTime() + NEARING_DAYS * 24 * 60 * 60 * 1000);

  // Trash totals (reclaimable by permanently deleting trash rows).
  const [trashContentAgg, trashAttachmentAgg] = await Promise.all([
    db
      .select({
        contentBytes: sql<number>`coalesce(sum(${mailboxMessageContentBytesExpr(messages)}), 0)::bigint`,
        messageCount: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(and(eq(messages.userId, userId), eq(messages.folder, "trash"))),

    db
      .select({
        attachmentBytes: sql<number>`coalesce(sum(${attachments.sizeBytes}), 0)::bigint`,
      })
      .from(attachments)
      .innerJoin(messages, eq(attachments.messageId, messages.id))
      .where(and(eq(messages.userId, userId), eq(messages.folder, "trash"))),
  ]);

  const trashContentBytes = Number(trashContentAgg[0]?.contentBytes ?? 0);
  const trashMessageCount = Number(trashContentAgg[0]?.messageCount ?? 0);
  const trashAttachmentBytes = Number(trashAttachmentAgg[0]?.attachmentBytes ?? 0);
  const trashTotalBytes = trashContentBytes + trashAttachmentBytes;

  // Near-auto-delete candidate messages (top by soonest auto-delete).
  const [nearingContentAgg, nearingAttachmentAgg, largestAgg] = await Promise.all([
    db
      .select({
        contentBytes: sql<number>`coalesce(sum(${mailboxMessageContentBytesExpr(messages)}), 0)::bigint`,
      })
      .from(messages)
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.folder, "trash"),
          lte(messages.trashDeleteAfterAt, nearDelete)
        )
      ),

    db
      .select({
        attachmentBytes: sql<number>`coalesce(sum(${attachments.sizeBytes}), 0)::bigint`,
      })
      .from(attachments)
      .innerJoin(messages, eq(attachments.messageId, messages.id))
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.folder, "trash"),
          lte(messages.trashDeleteAfterAt, nearDelete)
        )
      ),

    db
      .select({
        id: messages.id,
        subject: messages.subject,
        trashMovedAt: messages.trashMovedAt,
        trashDeleteAfterAt: messages.trashDeleteAfterAt,
        attachmentCount: sql<number>`count(${attachments.id})::int`,
        attachmentBytes: sql<number>`coalesce(sum(${attachments.sizeBytes}), 0)::bigint`,
        contentBytes: sql<number>`coalesce(max(${mailboxMessageContentBytesExpr(messages)}), 0)::bigint`,
      })
      .from(messages)
      .leftJoin(attachments, eq(attachments.messageId, messages.id))
      .where(and(eq(messages.userId, userId), eq(messages.folder, "trash")))
      .groupBy(messages.id, messages.subject, messages.trashMovedAt, messages.trashDeleteAfterAt)
      .orderBy(sql`coalesce(sum(${attachments.sizeBytes}), 0) DESC`)
      .limit(5),
  ]);

  const nearingContentBytes = Number(nearingContentAgg[0]?.contentBytes ?? 0);
  const nearingAttachmentBytes = Number(nearingAttachmentAgg[0]?.attachmentBytes ?? 0);
  const nearingTotalBytes = nearingContentBytes + nearingAttachmentBytes;

  // Large trash message list (largest attachments).
  const largestMessages = largestAgg.map((row) => {
    const contentBytes = Number(row.contentBytes ?? 0);
    const attachmentBytes = Number(row.attachmentBytes ?? 0);
    return {
      id: row.id,
      subject: row.subject ?? "",
      trashMovedAt: row.trashMovedAt ? row.trashMovedAt.toISOString() : null,
      trashDeleteAfterAt: row.trashDeleteAfterAt ? row.trashDeleteAfterAt.toISOString() : null,
      messageBytes: contentBytes,
      attachmentBytes,
      totalBytes: contentBytes + attachmentBytes,
      attachmentCount: Number(row.attachmentCount ?? 0),
      topAttachmentFilename: null as string | null,
      topAttachmentSizeBytes: null as number | null,
    };
  });

  // Near-auto-delete list (top by soonest deletion, limited).
  const nearingMessagesRows = await db
    .select({
      id: messages.id,
      subject: messages.subject,
      trashMovedAt: messages.trashMovedAt,
      trashDeleteAfterAt: messages.trashDeleteAfterAt,
      attachmentCount: sql<number>`count(${attachments.id})::int`,
      attachmentBytes: sql<number>`coalesce(sum(${attachments.sizeBytes}), 0)::bigint`,
      contentBytes: sql<number>`coalesce(max(${mailboxMessageContentBytesExpr(messages)}), 0)::bigint`,
    })
    .from(messages)
    .leftJoin(attachments, eq(attachments.messageId, messages.id))
    .where(
      and(
        eq(messages.userId, userId),
        eq(messages.folder, "trash"),
        lte(messages.trashDeleteAfterAt, nearDelete)
      )
    )
    .groupBy(messages.id, messages.subject, messages.trashMovedAt, messages.trashDeleteAfterAt)
    .orderBy(sql`${messages.trashDeleteAfterAt} ASC NULLS LAST`)
    .limit(5);

  const nearingMessages: CleanupMessageRow[] = nearingMessagesRows.map((row) => {
    const contentBytes = Number(row.contentBytes ?? 0);
    const attachmentBytes = Number(row.attachmentBytes ?? 0);
    return {
      id: row.id,
      subject: row.subject ?? "",
      trashMovedAt: row.trashMovedAt ? row.trashMovedAt.toISOString() : null,
      trashDeleteAfterAt: row.trashDeleteAfterAt ? row.trashDeleteAfterAt.toISOString() : null,
      messageBytes: contentBytes,
      attachmentBytes,
      totalBytes: contentBytes + attachmentBytes,
      attachmentCount: Number(row.attachmentCount ?? 0),
      topAttachmentFilename: null,
      topAttachmentSizeBytes: null,
    };
  });

  // Large-attachment list (for quick “start here” cleanup).
  const largeAttachmentRows = await db
    .select({
      attachmentId: attachments.id,
      filename: attachments.filename,
      sizeBytes: attachments.sizeBytes,
      messageId: attachments.messageId,
      subject: messages.subject,
      trashDeleteAfterAt: messages.trashDeleteAfterAt,
    })
    .from(attachments)
    .innerJoin(messages, eq(attachments.messageId, messages.id))
    .where(
      and(
        eq(messages.userId, userId),
        eq(messages.folder, "trash"),
        gte(attachments.sizeBytes, LARGE_ATTACHMENT_MIN_BYTES)
      )
    )
    .orderBy(desc(attachments.sizeBytes))
    .limit(5);

  // Draft attachments summary.
  const draftAgg = await Promise.all([
    db
      .select({
        updatedAt: composeDrafts.updatedAt,
      })
      .from(composeDrafts)
      .where(eq(composeDrafts.userId, userId))
      .limit(1),
    db
      .select({
        attachmentBytes: sql<number>`coalesce(sum(${composeAttachments.sizeBytes}), 0)::bigint`,
        attachmentCount: sql<number>`count(${composeAttachments.id})::int`,
      })
      .from(composeAttachments)
      .where(eq(composeAttachments.userId, userId)),
  ]);

  const draftUpdatedAt = draftAgg[0]?.[0]?.updatedAt
    ? draftAgg[0][0].updatedAt.toISOString()
    : null;
  const draftAttachmentBytes = Number(draftAgg[1]?.[0]?.attachmentBytes ?? 0);
  const draftAttachmentCount = Number(draftAgg[1]?.[0]?.attachmentCount ?? 0);

  // Top attachments for the items we will render (largest + near-delete lists).
  const allCandidateIds = [
    ...largestMessages.map((m) => m.id),
    ...nearingMessages.map((m) => m.id),
  ];
  const uniqueCandidateIds = [...new Set(allCandidateIds)];

  if (uniqueCandidateIds.length > 0) {
    const attRows = await db
      .select({
        messageId: attachments.messageId,
        filename: attachments.filename,
        sizeBytes: attachments.sizeBytes,
      })
      .from(attachments)
      .innerJoin(messages, eq(attachments.messageId, messages.id))
      .where(
        and(
          eq(messages.userId, userId),
          eq(messages.folder, "trash"),
          inArray(attachments.messageId, uniqueCandidateIds)
        )
      )
      .orderBy(desc(attachments.sizeBytes))
      .limit(uniqueCandidateIds.length * 3);

    const topByMessage = new Map<string, { filename: string; sizeBytes: number }>();
    for (const r of attRows) {
      if (!topByMessage.has(r.messageId)) {
        topByMessage.set(r.messageId, {
          filename: r.filename,
          sizeBytes: Number(r.sizeBytes ?? 0),
        });
      }
    }

    for (const m of largestMessages) {
      const top = topByMessage.get(m.id);
      if (top) {
        m.topAttachmentFilename = top.filename;
        m.topAttachmentSizeBytes = top.sizeBytes;
      }
    }
    for (const m of nearingMessages) {
      const top = topByMessage.get(m.id);
      if (top) {
        m.topAttachmentFilename = top.filename;
        m.topAttachmentSizeBytes = top.sizeBytes;
      }
    }
  }

  const totalsByMessageId = new Map<string, { totalBytes: number }>();
  for (const m of largestMessages) totalsByMessageId.set(m.id, { totalBytes: m.totalBytes });
  for (const m of nearingMessages) totalsByMessageId.set(m.id, { totalBytes: m.totalBytes });

  const largeAttachments = largeAttachmentRows.map((r) => {
    const totalBytes = totalsByMessageId.get(r.messageId)?.totalBytes ?? 0;
    return {
      attachmentId: r.attachmentId,
      messageId: r.messageId,
      filename: r.filename,
      sizeBytes: Number(r.sizeBytes ?? 0),
      subject: r.subject ?? "",
      trashDeleteAfterAt: r.trashDeleteAfterAt ? r.trashDeleteAfterAt.toISOString() : null,
      reclaimBytes: totalBytes > 0 ? totalBytes : Number(r.sizeBytes ?? 0),
    };
  });

  const suggestions: {
    id: string;
    title: string;
    detail: string;
    reclaimBytes: number;
    cta?: { kind: "trash"; deleteIds?: string[] } | { kind: "drafts" };
  }[] = [];

  if (threshold.level === "full") {
    suggestions.push({
      id: "s_trash_full",
      title: "Your storage is full. Delete files or upgrade your plan.",
      detail:
        trashTotalBytes > 0
          ? `Deleting old items in Trash could free up about ${nearbyHuman(nearingTotalBytes)}.`
          : "Try deleting items in Trash or upgrading your plan.",
      reclaimBytes: nearingTotalBytes,
      cta: nearingMessages.length > 0 ? { kind: "trash", deleteIds: nearingMessages.map((m) => m.id) } : undefined,
    });
  }

  if (threshold.level === "warning95") {
    suggestions.push({
      id: "s_trash_95",
      title: "Your storage is almost full.",
      detail:
        nearingTotalBytes > 0
          ? `Old messages in Trash are using storage. Cleaning soon-to-expire items can free up about ${nearbyHuman(nearingTotalBytes)}.`
          : "Check Trash for items that can be deleted.",
      reclaimBytes: nearingTotalBytes,
      cta: nearingMessages.length > 0 ? { kind: "trash", deleteIds: nearingMessages.map((m) => m.id) } : undefined,
    });
  }

  if (threshold.level === "warning80") {
    suggestions.push({
      id: "s_trash_80",
      title: "You are running low on storage.",
      detail:
        nearingTotalBytes > 0
          ? `You can free up about ${nearbyHuman(nearingTotalBytes)} by cleaning old items in Trash.`
          : "You can free space by deleting attachments or old messages.",
      reclaimBytes: nearingTotalBytes,
      cta: nearingMessages.length > 0 ? { kind: "trash", deleteIds: nearingMessages.map((m) => m.id) } : undefined,
    });
  }

  if (draftAttachmentBytes > 0) {
    suggestions.push({
      id: "s_drafts",
      title: "Delete unused drafts to save space",
      detail: `Draft attachments are using about ${nearbyHuman(draftAttachmentBytes)}. Deleting drafts will permanently remove them.`,
      reclaimBytes: draftAttachmentBytes,
      cta: { kind: "drafts" },
    });
  }

  return NextResponse.json({
    trash: {
      messageCount: trashMessageCount,
      bytesUsed: trashTotalBytes,
    },
    largeAttachments: {
      minBytes: LARGE_ATTACHMENT_MIN_BYTES,
      attachments: largeAttachments,
    },
    nearing: {
      totalBytes: nearingTotalBytes,
      days: NEARING_DAYS,
      messages: nearingMessages,
    },
    largest: {
      messages: largestMessages,
    },
    drafts: {
      updatedAt: draftUpdatedAt,
      attachmentBytes: draftAttachmentBytes,
      attachmentCount: draftAttachmentCount,
    },
    suggestions,
  });
}

function nearbyHuman(bytes: number): string {
  // UI already formats bytes, but suggestions must include a readable number.
  const v = Math.max(0, bytes);
  const GB = 1024 * 1024 * 1024;
  const MB = 1024 * 1024;
  if (v >= GB) return `${(v / GB).toFixed(2)} GB`;
  if (v >= MB) return `${(v / MB).toFixed(0)} MB`;
  const KB = 1024;
  if (v >= KB) return `${(v / KB).toFixed(0)} KB`;
  return `${v} B`;
}

