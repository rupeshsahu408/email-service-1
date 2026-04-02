import { NextRequest, NextResponse } from "next/server";
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { messageLabels, messages, type MessageFolder } from "@/db/schema";
import { logError } from "@/lib/logger";
import { resolveSenderIdentities } from "@/lib/sender-identity";
import { getCurrentUser } from "@/lib/session";
import {
  deleteExpiredTrashMessages,
  getTrashLifecyclePatch,
} from "@/lib/trash-lifecycle";
import { isPostgresUndefinedColumnError } from "@/lib/pg-error";

export const dynamic = "force-dynamic";

const folders: MessageFolder[] = ["inbox", "sent", "spam", "trash", "archive"];

const MAX_PAGE = 500;
const MAX_OFFSET = 20_000;
const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

function sanitizeSearchTerm(q: string): string {
  return q.trim().slice(0, 200).replace(/[^\p{L}\p{N}\s.@+-]/gu, "");
}

function parseOptionalIsoDate(raw: string | null): Date | null {
  if (!raw || raw.length > 40) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

function parseListPaging(sp: URLSearchParams): { limit: number; offset: number } {
  const rawLimit = Number.parseInt(sp.get("limit") ?? `${MAX_PAGE}`, 10);
  const rawOffset = Number.parseInt(sp.get("offset") ?? "0", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(MAX_PAGE, Math.max(1, rawLimit))
    : MAX_PAGE;
  const offset = Number.isFinite(rawOffset)
    ? Math.min(MAX_OFFSET, Math.max(0, rawOffset))
    : 0;
  return { limit, offset };
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const folderParam = sp.get("folder") ?? "inbox";
  const starredOnly = sp.get("starred") === "1";
  const labelIdRaw = sp.get("labelId");
  const qRaw = sp.get("q") ?? "";
  const hasAttachment = sp.get("hasAttachment") === "1";
  const sinceDate = parseOptionalIsoDate(sp.get("since"));
  const untilDate = parseOptionalIsoDate(sp.get("until"));

  const db = getDb();
  if (folderParam === "trash") {
    try {
      await deleteExpiredTrashMessages(db, user.id);
    } catch (e) {
      if (!isPostgresUndefinedColumnError(e)) throw e;
    }
  }

  const { limit, offset } = parseListPaging(sp);
  const fetchLimit = limit + 1;
  const term = sanitizeSearchTerm(qRaw);
  const searchPattern = term.length > 0 ? `%${term}%` : null;

  const labelFilter =
    labelIdRaw && /^[0-9a-f-]{36}$/i.test(labelIdRaw) ? labelIdRaw : null;

  const orderClause = [
    desc(messages.pinned),
    sql`${messages.pinnedAt} DESC NULLS LAST`,
    desc(messages.createdAt),
  ];

  const baseConds = [eq(messages.userId, user.id)];

  if (folderParam === "starred") {
    baseConds.push(eq(messages.starred, true));
    baseConds.push(ne(messages.folder, "trash"));
  } else {
    const folder = folders.includes(folderParam as MessageFolder)
      ? (folderParam as MessageFolder)
      : "inbox";
    baseConds.push(eq(messages.folder, folder));
    if (starredOnly) baseConds.push(eq(messages.starred, true));
  }

  if (hasAttachment) baseConds.push(eq(messages.hasAttachment, true));

  if (sinceDate) baseConds.push(gte(messages.createdAt, sinceDate));
  if (untilDate) baseConds.push(lte(messages.createdAt, untilDate));

  if (searchPattern) {
    baseConds.push(
      or(
        ilike(messages.subject, searchPattern),
        ilike(messages.fromAddr, searchPattern),
        ilike(messages.toAddr, searchPattern),
        ilike(messages.snippet, searchPattern),
        ilike(messages.bodyText, searchPattern)
      )!
    );
  }

  if (labelFilter) {
    baseConds.push(eq(messageLabels.labelId, labelFilter));
  }

  const whereAll = and(...baseConds)!;

  const selectShape = {
    id: messages.id,
    folder: messages.folder,
    subject: messages.subject,
    snippet: messages.snippet,
    fromAddr: messages.fromAddr,
    toAddr: messages.toAddr,
    ccAddr: messages.ccAddr,
    readAt: messages.readAt,
    createdAt: messages.createdAt,
    starred: messages.starred,
    pinned: messages.pinned,
    pinnedAt: messages.pinnedAt,
    threadId: messages.threadId,
    hasAttachment: messages.hasAttachment,
    sentAnonymously: messages.sentAnonymously,
    spamScore: messages.spamScore,
  };
  const selectShapeWithTrash = {
    ...selectShape,
    trashMovedAt: messages.trashMovedAt,
    trashDeleteAfterAt: messages.trashDeleteAfterAt,
  };

  try {
  const runListQuery = async (includeTrashColumns: boolean) => {
    const shape = includeTrashColumns ? selectShapeWithTrash : selectShape;
    return labelFilter
      ? await db
          .select(shape)
          .from(messages)
          .innerJoin(messageLabels, eq(messages.id, messageLabels.messageId))
          .where(whereAll)
          .orderBy(...orderClause)
          .limit(fetchLimit)
          .offset(offset)
      : await db
          .select(shape)
          .from(messages)
          .where(whereAll)
          .orderBy(...orderClause)
          .limit(fetchLimit)
          .offset(offset);
  };

  let rawRows: Awaited<ReturnType<typeof runListQuery>>;
  try {
    rawRows = await runListQuery(true);
  } catch (queryErr) {
    if (!isPostgresUndefinedColumnError(queryErr)) throw queryErr;
    rawRows = await runListQuery(false);
  }

  const hasMore = rawRows.length > limit;
  const rows = rawRows.slice(0, limit);

  const fromAddrs = rows.map((r) => r.fromAddr);
  const senderMap = await resolveSenderIdentities(fromAddrs);

  const ids = rows.map((r) => r.id);
  const labelMap = new Map<string, string[]>();
  if (ids.length > 0) {
    const links = await db
      .select({
        messageId: messageLabels.messageId,
        labelId: messageLabels.labelId,
      })
      .from(messageLabels)
      .where(inArray(messageLabels.messageId, ids));
    for (const l of links) {
      const cur = labelMap.get(l.messageId) ?? [];
      cur.push(l.labelId);
      labelMap.set(l.messageId, cur);
    }
  }

  return NextResponse.json(
    {
      messages: rows.map((r) => ({
        ...r,
        labelIds: labelMap.get(r.id) ?? [],
        senderIdentity: senderMap.get(r.fromAddr) ?? null,
      })),
      limit,
      offset,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    },
    { headers: { "cache-control": "no-store, max-age=0" } }
  );
  } catch (e) {
    logError("mail_messages_list_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json(
      { error: "Could not load messages." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const ids = [...new Set(parsed.data.ids)];
  const db = getDb();

  try {
    const ownedRows = await db
      .select({ id: messages.id, folder: messages.folder })
      .from(messages)
      .where(and(eq(messages.userId, user.id), inArray(messages.id, ids)));

    if (ownedRows.length === 0) {
      return NextResponse.json({ ok: true, movedToTrashIds: [], deletedIds: [] });
    }

    const moveToTrashIds = ownedRows
      .filter((row) => row.folder !== "trash")
      .map((row) => row.id);
    if (moveToTrashIds.length > 0) {
      await db
        .update(messages)
        .set(getTrashLifecyclePatch())
        .where(and(eq(messages.userId, user.id), inArray(messages.id, moveToTrashIds)));
    }

    return NextResponse.json({
      ok: true,
      movedToTrashIds: moveToTrashIds,
      deletedIds: [],
    });
  } catch (e) {
    logError("mail_messages_bulk_delete_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json({ error: "Could not delete messages." }, { status: 500 });
  }
}
