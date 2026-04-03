import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { getAuthContext } from "@/lib/session";
import { tryResolveMailboxAccess, canReadInbox } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

function csvEscape(s: string): string {
  const t = s.replace(/\r?\n/g, " ").replace(/"/g, '""');
  return `"${t}"`;
}

function parseInboxOwnerId(sp: URLSearchParams): string | null {
  const raw = sp.get("inboxOwnerId");
  return raw && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = await tryResolveMailboxAccess(
    ctx.user.id,
    parseInboxOwnerId(request.nextUrl.searchParams)
  );
  if (!access || !canReadInbox(access)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const mailboxUserId = access.inboxOwnerUserId;
  const limit = Math.min(
    5000,
    Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "2000", 10) || 2000)
  );

  const rows = await getDb()
    .select({
      id: messages.id,
      folder: messages.folder,
      createdAt: messages.createdAt,
      subject: messages.subject,
      fromAddr: messages.fromAddr,
      toAddr: messages.toAddr,
      readAt: messages.readAt,
      snippet: messages.snippet,
    })
    .from(messages)
    .where(eq(messages.userId, mailboxUserId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  const header =
    "id,folder,createdAt,subject,fromAddr,toAddr,readAt,snippet\n";
  const body = rows
    .map(
      (r) =>
        [
          r.id,
          r.folder,
          r.createdAt.toISOString(),
          csvEscape(r.subject ?? ""),
          csvEscape(r.fromAddr ?? ""),
          csvEscape(r.toAddr ?? ""),
          r.readAt ? r.readAt.toISOString() : "",
          csvEscape(r.snippet ?? ""),
        ].join(",")
    )
    .join("\n");

  return new NextResponse(header + body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="sendora-mail-export.csv"',
      "cache-control": "no-store",
    },
  });
}
