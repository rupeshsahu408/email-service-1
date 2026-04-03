import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getUserAnalytics } from "@/lib/user-analytics";
import { getAuthContext } from "@/lib/session";
import {
  tryResolveMailboxAccess,
  canViewTeamAnalytics,
} from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

const rangeSchema = z.enum(["today", "7d", "30d"]);

function csvEscape(s: string): string {
  const t = String(s).replace(/\r?\n/g, " ").replace(/"/g, '""');
  return `"${t}"`;
}

function parseInboxOwnerId(sp: URLSearchParams): string | null {
  const raw = sp.get("forUserId") ?? sp.get("inboxOwnerId");
  return raw && /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = request.nextUrl.searchParams;
  const parsed = rangeSchema.safeParse(sp.get("range") ?? "7d");
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }
  const range = parsed.data;
  const useAi = sp.get("ai") === "1";
  const format = sp.get("format") === "html" ? "html" : "csv";

  let analyticsUserId = ctx.user.id;
  let localPart = ctx.user.localPart;
  const forId = parseInboxOwnerId(sp);
  if (forId && forId !== ctx.user.id) {
    const access = await tryResolveMailboxAccess(ctx.user.id, forId);
    if (!access || !canViewTeamAnalytics(access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    analyticsUserId = access.inboxOwnerUserId;
    const [row] = await getDb()
      .select({ localPart: users.localPart })
      .from(users)
      .where(eq(users.id, analyticsUserId))
      .limit(1);
    if (row) localPart = row.localPart;
  }

  const data = await getUserAnalytics(analyticsUserId, localPart, range, {
    useAiCategories: useAi,
  });

  if (format === "html") {
    const pre = JSON.stringify(data, null, 2);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Analytics export</title></head><body><pre>${pre.replace(
      /</g,
      "&lt;"
    )}</pre><p>Print this page to PDF from your browser.</p></body></html>`;
    return new NextResponse(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const lines: string[] = ["section,key,value"];
  const walk = (prefix: string, obj: unknown) => {
    if (obj == null) {
      lines.push(`${prefix},value,`);
      return;
    }
    if (typeof obj !== "object") {
      lines.push(`${prefix},value,${csvEscape(String(obj))}`);
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => walk(`${prefix}[${i}]`, item));
      return;
   }
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const next = prefix ? `${prefix}.${k}` : k;
      if (v != null && typeof v === "object" && !Array.isArray(v)) {
        walk(next, v);
      } else if (Array.isArray(v)) {
        walk(next, v);
      } else {
        lines.push(`${next},${csvEscape(String(v))},`);
      }
    }
  };
  walk("analytics", data);

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="sendora-analytics.csv"',
      "cache-control": "no-store",
    },
  });
}
