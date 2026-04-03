import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { composeAttachments } from "@/db/schema";
import {
  classifyAttachmentStorageKey,
  deleteAttachmentFile,
  readAttachmentBuffer,
} from "@/lib/attachments-storage";
import { logInfo } from "@/lib/logger";
import { getCurrentUser } from "@/lib/session";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const rows = await getDb()
    .select({
      filename: composeAttachments.filename,
      mimeType: composeAttachments.mimeType,
      storageKey: composeAttachments.storageKey,
    })
    .from(composeAttachments)
    .where(and(eq(composeAttachments.id, id), eq(composeAttachments.userId, user.id)))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = rows[0];
  try {
    const keyType = classifyAttachmentStorageKey(row.storageKey);
    if (keyType === "cloud") {
      logInfo("attachment_download_legacy_cloud_path", {
        scope: "draft",
        attachmentId: id,
        storageKey: row.storageKey,
      });
    }
    const buf = await readAttachmentBuffer(row.storageKey, row.mimeType);
    const safeName = row.filename.replace(/[\r\n"]/g, "_");
    const bytes = new Uint8Array(buf);
    return new Response(bytes, {
      headers: {
        "Content-Type": row.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
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

  const rows = await getDb()
    .select({ storageKey: composeAttachments.storageKey })
    .from(composeAttachments)
    .where(and(eq(composeAttachments.id, id), eq(composeAttachments.userId, user.id)))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await getDb()
    .delete(composeAttachments)
    .where(and(eq(composeAttachments.id, id), eq(composeAttachments.userId, user.id)));

  await deleteAttachmentFile(rows[0]!.storageKey).catch(() => {
    // Ignore remote cleanup failures so DB delete remains successful.
  });

  return NextResponse.json({ ok: true });
}

