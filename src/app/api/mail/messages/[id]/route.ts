import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attachments,
  labels,
  messageLabels,
  messages,
  type MessageFolder,
} from "@/db/schema";
import { sanitizeHtmlForViewer } from "@/lib/message-display";
import { hasMessageAuthColumns } from "@/lib/message-auth-columns";
import { resolveSingleSenderIdentity } from "@/lib/sender-identity";
import { getCurrentUser } from "@/lib/session";
import {
  getRestoreFromTrashPatch,
  getTrashLifecyclePatch,
} from "@/lib/trash-lifecycle";
import { ensureUserSettingsRow } from "@/lib/user-settings";
import { isPostgresUndefinedColumnError } from "@/lib/pg-error";
import { upsertSenderMailPreference } from "@/lib/sender-mail-preference";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  folder: z.enum(["inbox", "sent", "spam", "trash", "archive"]).optional(),
  read: z.boolean().optional(),
  starred: z.boolean().optional(),
  pinned: z.boolean().optional(),
  labelIds: z.array(z.string().uuid()).optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const canReadAuthCols = await hasMessageAuthColumns();
  const db = getDb();
  const legacyShape = {
    id: messages.id,
    userId: messages.userId,
    folder: messages.folder,
    providerMessageId: messages.providerMessageId,
    subject: messages.subject,
    snippet: messages.snippet,
    bodyText: messages.bodyText,
    bodyHtml: messages.bodyHtml,
    fromAddr: messages.fromAddr,
    toAddr: messages.toAddr,
    ccAddr: messages.ccAddr,
    bccAddr: messages.bccAddr,
    readAt: messages.readAt,
    createdAt: messages.createdAt,
    starred: messages.starred,
    pinned: messages.pinned,
    pinnedAt: messages.pinnedAt,
    threadId: messages.threadId,
    inReplyTo: messages.inReplyTo,
    hasAttachment: messages.hasAttachment,
    sentAnonymously: messages.sentAnonymously,
    mailedBy: messages.fromAddr,
    signedBy: messages.inReplyTo,
  };
  const legacyShapeWithTrash = {
    ...legacyShape,
    trashMovedAt: messages.trashMovedAt,
    trashDeleteAfterAt: messages.trashDeleteAfterAt,
  };
  const legacyQuery = async (includeTrashColumns: boolean) =>
    db
      .select(includeTrashColumns ? legacyShapeWithTrash : legacyShape)
      .from(messages)
      .where(and(eq(messages.id, id), eq(messages.userId, user.id)))
      .limit(1)
      .then((rs) =>
        rs.map((r) => ({
          ...r,
          mailedBy: null,
          signedBy: null,
        }))
      );

  let rows;
  if (canReadAuthCols) {
    try {
      rows = await db
        .select()
        .from(messages)
        .where(and(eq(messages.id, id), eq(messages.userId, user.id)))
        .limit(1);
    } catch (queryErr) {
      if (!isPostgresUndefinedColumnError(queryErr)) throw queryErr;
      rows = await legacyQuery(false);
    }
  } else {
    try {
      rows = await legacyQuery(true);
    } catch (queryErr) {
      if (!isPostgresUndefinedColumnError(queryErr)) throw queryErr;
      rows = await legacyQuery(false);
    }
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const att = await getDb()
    .select({
      id: attachments.id,
      filename: attachments.filename,
      mimeType: attachments.mimeType,
      sizeBytes: attachments.sizeBytes,
    })
    .from(attachments)
    .where(eq(attachments.messageId, id));
  const labs = await getDb()
    .select({ labelId: messageLabels.labelId })
    .from(messageLabels)
    .where(eq(messageLabels.messageId, id));
  const prefs = await ensureUserSettingsRow(user.id);
  const msg = {
    ...rows[0],
    bodyHtml: sanitizeHtmlForViewer(rows[0].bodyHtml, prefs),
  };
  const senderIdentity = await resolveSingleSenderIdentity(rows[0]!.fromAddr);

  return NextResponse.json(
    {
      message: msg,
      attachments: att,
      labelIds: labs.map((l) => l.labelId),
      senderIdentity,
    },
    { headers: { "cache-control": "no-store, max-age=0" } }
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const db = getDb();
  let row: {
    id: string;
    folder: MessageFolder;
    fromAddr: string;
    spamScore: number;
  };
  try {
    const existing = await db
      .select({
        id: messages.id,
        folder: messages.folder,
        fromAddr: messages.fromAddr,
        spamScore: messages.spamScore,
      })
      .from(messages)
      .where(and(eq(messages.id, id), eq(messages.userId, user.id)))
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    row = existing[0]!;
  } catch (e) {
    if (!isPostgresUndefinedColumnError(e)) throw e;
    const fallback = await db
      .select({
        id: messages.id,
        folder: messages.folder,
        fromAddr: messages.fromAddr,
      })
      .from(messages)
      .where(and(eq(messages.id, id), eq(messages.userId, user.id)))
      .limit(1);
    if (fallback.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const f = fallback[0]!;
    row = { id: f.id, folder: f.folder, fromAddr: f.fromAddr, spamScore: 0 };
  }
  const updates: Partial<{
    folder: MessageFolder;
    readAt: Date | null;
    starred: boolean;
    pinned: boolean;
    pinnedAt: Date | null;
    trashMovedAt: Date | null;
    trashDeleteAfterAt: Date | null;
    spamScore: number;
  }> = {};
  let trainSenderSpam = false;
  let trainSenderTrust = false;

  if (parsed.data.folder !== undefined) {
    const nextFolder = parsed.data.folder;
    if (nextFolder === "trash") {
      Object.assign(updates, getTrashLifecyclePatch());
    } else {
      updates.folder = nextFolder;
      Object.assign(updates, getRestoreFromTrashPatch());
    }

    if (nextFolder === "spam" && row.folder !== "spam") {
      trainSenderSpam = true;
      updates.spamScore = Math.max(Number(row.spamScore ?? 0), 10);
    }
    if (nextFolder === "inbox" && row.folder === "spam") {
      trainSenderTrust = true;
      updates.spamScore = 0;
    }
  }
  if (parsed.data.read === true) {
    updates.readAt = new Date();
  } else if (parsed.data.read === false) {
    updates.readAt = null;
  }
  if (parsed.data.starred !== undefined) {
    updates.starred = parsed.data.starred;
  }
  if (parsed.data.pinned !== undefined) {
    updates.pinned = parsed.data.pinned;
    updates.pinnedAt = parsed.data.pinned ? new Date() : null;
  }

  if (Object.keys(updates).length > 0) {
    try {
      await db
        .update(messages)
        .set(updates)
        .where(and(eq(messages.id, id), eq(messages.userId, user.id)));
    } catch (e) {
      if (!isPostgresUndefinedColumnError(e)) throw e;
      const { spamScore: _s, ...rest } = updates;
      if (Object.keys(rest).length > 0) {
        await db
          .update(messages)
          .set(rest)
          .where(and(eq(messages.id, id), eq(messages.userId, user.id)));
      }
    }
  }

  if (trainSenderSpam) {
    try {
      await upsertSenderMailPreference({
        userId: user.id,
        fromAddr: row.fromAddr,
        preference: "spam",
      });
    } catch {
      /* preferences table may be missing on unmigrated DB */
    }
  }
  if (trainSenderTrust) {
    try {
      await upsertSenderMailPreference({
        userId: user.id,
        fromAddr: row.fromAddr,
        preference: "trust",
      });
    } catch {
      /* ignore */
    }
  }

  if (parsed.data.labelIds !== undefined) {
    const labelIds = parsed.data.labelIds;
    if (labelIds.length > 0) {
      const allowedRows = await db
        .select({ id: labels.id })
        .from(labels)
        .where(and(eq(labels.userId, user.id), inArray(labels.id, labelIds)));
      if (allowedRows.length !== labelIds.length) {
        return NextResponse.json({ error: "Invalid label" }, { status: 400 });
      }
    }
    await db.delete(messageLabels).where(eq(messageLabels.messageId, id));
    if (labelIds.length > 0) {
      await db.insert(messageLabels).values(
        labelIds.map((lid) => ({ messageId: id, labelId: lid }))
      );
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;

  const existing = await getDb()
    .select({ folder: messages.folder })
    .from(messages)
    .where(and(eq(messages.id, id), eq(messages.userId, user.id)))
    .limit(1);
  if (existing.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing[0].folder !== "trash") {
    await getDb()
      .update(messages)
      .set(getTrashLifecyclePatch())
      .where(and(eq(messages.id, id), eq(messages.userId, user.id)));
  }

  return NextResponse.json({ ok: true });
}
