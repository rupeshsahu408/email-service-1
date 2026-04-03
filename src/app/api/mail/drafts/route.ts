import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { composeAttachments, composeDrafts } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import {
  STORAGE_ERROR_CODE,
  STORAGE_MESSAGE_FULL,
  getUserStorageSnapshot,
  isStorageFull,
} from "@/lib/storage-quota";

const putSchema = z.object({
  toAddr: z.string().max(2048).optional(),
  ccAddr: z.string().max(2048).optional(),
  bccAddr: z.string().max(2048).optional(),
  subject: z.string().max(998).optional(),
  bodyText: z.string().max(500_000).optional(),
  bodyHtml: z.string().max(500_000).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await getDb()
    .select()
    .from(composeDrafts)
    .where(eq(composeDrafts.userId, user.id))
    .limit(1);
  const draft = rows[0] ?? {
    toAddr: "",
    ccAddr: "",
    bccAddr: "",
    subject: "",
    bodyText: "",
    bodyHtml: "",
    updatedAt: null as Date | null,
  };
  return NextResponse.json({ draft });
}

export async function PUT(request: NextRequest) {
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
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const db = getDb();
  const storageSnap = await getUserStorageSnapshot(db, user);
  const [{ n: composeAttCount }] = await db
    .select({ n: count() })
    .from(composeAttachments)
    .where(eq(composeAttachments.userId, user.id));
  if (isStorageFull(storageSnap) && Number(composeAttCount ?? 0) > 0) {
    return NextResponse.json(
      { error: STORAGE_MESSAGE_FULL, code: STORAGE_ERROR_CODE },
      { status: 403 }
    );
  }

  const values = {
    userId: user.id,
    toAddr: parsed.data.toAddr ?? "",
    ccAddr: parsed.data.ccAddr ?? "",
    bccAddr: parsed.data.bccAddr ?? "",
    subject: parsed.data.subject ?? "",
    bodyText: parsed.data.bodyText ?? "",
    bodyHtml: parsed.data.bodyHtml ?? "",
    updatedAt: new Date(),
  };

  await db
    .insert(composeDrafts)
    .values(values)
    .onConflictDoUpdate({
      target: composeDrafts.userId,
      set: {
        toAddr: values.toAddr,
        ccAddr: values.ccAddr,
        bccAddr: values.bccAddr,
        subject: values.subject,
        bodyText: values.bodyText,
        bodyHtml: values.bodyHtml,
        updatedAt: values.updatedAt,
      },
    });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Remove both the single-row draft and any associated uploaded attachments.
  await getDb()
    .delete(composeAttachments)
    .where(eq(composeAttachments.userId, user.id));
  await getDb().delete(composeDrafts).where(eq(composeDrafts.userId, user.id));
  return NextResponse.json({ ok: true });
}
