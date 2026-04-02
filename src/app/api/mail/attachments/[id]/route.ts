import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { attachments, messages } from "@/db/schema";
import {
  classifyAttachmentStorageKey,
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
      filename: attachments.filename,
      mimeType: attachments.mimeType,
      storageKey: attachments.storageKey,
    })
    .from(attachments)
    .innerJoin(messages, eq(attachments.messageId, messages.id))
    .where(and(eq(attachments.id, id), eq(messages.userId, user.id)))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = rows[0];
  try {
    const keyType = classifyAttachmentStorageKey(row.storageKey);
    if (keyType === "cloud") {
      logInfo("attachment_download_legacy_cloud_path", {
        scope: "message",
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
