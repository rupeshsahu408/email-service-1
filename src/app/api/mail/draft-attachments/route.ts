import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { composeAttachments } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import {
  classifyAttachmentStorageKey,
  saveAttachmentFile,
} from "@/lib/attachments-storage";
import { logInfo } from "@/lib/logger";
import {
  STORAGE_ERROR_CODE,
  STORAGE_MESSAGE_FULL,
  getUserStorageSnapshot,
  isStorageFull,
} from "@/lib/storage-quota";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getDb()
    .select()
    .from(composeAttachments)
    .where(eq(composeAttachments.userId, user.id))
    .orderBy(desc(composeAttachments.createdAt))
    .limit(50);

  return NextResponse.json({
    attachments: rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      contentId: r.contentId,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const files: File[] = [];
  for (const [, val] of form.entries()) {
    if (!(val instanceof File)) continue;
    if (val.size <= 0) continue;
    files.push(val);
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  const storageSnap = await getUserStorageSnapshot(getDb(), user);
  if (isStorageFull(storageSnap)) {
    return NextResponse.json(
      { error: STORAGE_MESSAGE_FULL, code: STORAGE_ERROR_CODE },
      { status: 403 }
    );
  }

  const uploaded: {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    contentId: string | null;
  }[] = [];

  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    const isImage = (f.type || "").toLowerCase().startsWith("image/");
    const contentId = isImage ? randomUUID() : null;

    const { storageKey, sizeBytes } = await saveAttachmentFile(
      user.id,
      "compose-draft",
      f.name,
      buf,
      f.type || "application/octet-stream"
    );

    const inserted = await getDb()
      .insert(composeAttachments)
      .values({
        userId: user.id,
        filename: f.name.slice(0, 512),
        mimeType: (f.type || "application/octet-stream").slice(0, 255),
        sizeBytes,
        storageKey,
        contentId: contentId ?? undefined,
      })
      .returning({
        id: composeAttachments.id,
        filename: composeAttachments.filename,
        mimeType: composeAttachments.mimeType,
        sizeBytes: composeAttachments.sizeBytes,
        contentId: composeAttachments.contentId,
        storageKey: composeAttachments.storageKey,
      });

    const row = inserted[0];
    if (row) {
      logInfo("compose_attachment_db_insert", {
        attachmentId: String(row.id),
        storageKey: row.storageKey,
        keyType: classifyAttachmentStorageKey(row.storageKey),
        filename: row.filename.slice(0, 120),
        mimeType: row.mimeType ?? "",
        sizeBytes: row.sizeBytes,
        dbMatchesSaveExactly: row.storageKey === storageKey,
      });
      uploaded.push({
        id: row.id,
        filename: row.filename,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        contentId: row.contentId ?? null,
      });
    }
  }

  return NextResponse.json({ attachments: uploaded });
}

