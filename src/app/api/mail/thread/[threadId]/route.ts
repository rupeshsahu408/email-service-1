import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { attachments, messageLabels, messages } from "@/db/schema";
import { hasMessageAuthColumns } from "@/lib/message-auth-columns";
import { sanitizeHtmlForViewer } from "@/lib/message-display";
import { resolveSenderIdentities } from "@/lib/sender-identity";
import { getCurrentUser } from "@/lib/session";
import { ensureUserSettingsRow } from "@/lib/user-settings";
import { isPostgresUndefinedColumnError } from "@/lib/pg-error";

export const dynamic = "force-dynamic";

/** All `messages` columns used by the thread view except trash lifecycle (may be missing on older DBs). */
const threadMsgShapeNoTrashWithAuth = {
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
  mailedBy: messages.mailedBy,
  signedBy: messages.signedBy,
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await context.params;
  const focus = request.nextUrl.searchParams.get("focus");

  const canReadAuthCols = await hasMessageAuthColumns();
  const db = getDb();
  const threadWhere = and(
    eq(messages.userId, user.id),
    eq(messages.threadId, threadId)
  );

  let msgs;
  if (canReadAuthCols) {
    try {
      msgs = await db
        .select()
        .from(messages)
        .where(threadWhere)
        .orderBy(asc(messages.createdAt))
        .limit(400);
    } catch (e) {
      if (!isPostgresUndefinedColumnError(e)) throw e;
      msgs = await db
        .select(threadMsgShapeNoTrashWithAuth)
        .from(messages)
        .where(threadWhere)
        .orderBy(asc(messages.createdAt))
        .limit(400);
    }
  } else {
    msgs = await db
      .select({
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
      })
      .from(messages)
      .where(threadWhere)
      .orderBy(asc(messages.createdAt))
      .limit(400)
      .then((rows) =>
        rows.map((r) => ({
          ...r,
          mailedBy: null,
          signedBy: null,
        }))
      );
  }

  if (msgs.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ids = msgs.map((m) => m.id);
  const att = await getDb()
    .select({
      id: attachments.id,
      messageId: attachments.messageId,
      filename: attachments.filename,
      mimeType: attachments.mimeType,
      sizeBytes: attachments.sizeBytes,
    })
    .from(attachments)
    .where(inArray(attachments.messageId, ids));

  const focusId =
    focus && ids.includes(focus) ? focus : msgs[msgs.length - 1]!.id;

  const labelRows = await getDb()
    .select({ labelId: messageLabels.labelId })
    .from(messageLabels)
    .where(eq(messageLabels.messageId, focusId));

  const prefs = await ensureUserSettingsRow(user.id);
  const sanitized = msgs.map((m) => ({
    ...m,
    bodyHtml: sanitizeHtmlForViewer(m.bodyHtml, prefs),
  }));

  const senderMap = await resolveSenderIdentities(sanitized.map((m) => m.fromAddr));

  return NextResponse.json(
    {
      messages: sanitized.map((m) => ({
        ...m,
        senderIdentity: senderMap.get(m.fromAddr) ?? null,
      })),
      attachments: att,
      labelIds: labelRows.map((r) => r.labelId),
      focusId,
    },
    { headers: { "cache-control": "no-store, max-age=0" } }
  );
}
