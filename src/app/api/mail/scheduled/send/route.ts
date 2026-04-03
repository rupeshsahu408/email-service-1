import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { randomUUID, createHash } from "crypto";
import { getDb } from "@/db";
import {
  composeAttachments,
  confidentialMessages,
  scheduledEmails,
  scheduledEmailAttachments,
} from "@/db/schema";
import {
  classifyAttachmentStorageKey,
  readOutboundAttachmentBuffer,
  saveAttachmentFile,
} from "@/lib/attachments-storage";
import { logError, logInfo } from "@/lib/logger";
import { getCurrentUser } from "@/lib/session";
import { ensureUserSettingsRow } from "@/lib/user-settings";
import {
  STORAGE_ERROR_CODE,
  STORAGE_MESSAGE_FULL,
  getUserStorageSnapshot,
  isStorageFull,
} from "@/lib/storage-quota";

const confidentialSchema = z
  .object({
    enabled: z.boolean().optional().default(false),
    expiresAt: z.string().datetime().optional(),
    passcodeMode: z.enum(["none", "email_otp", "sms_otp"]).optional().default("none"),
  })
  .optional();

const createSchema = z.object({
  to: z.string().min(1),
  cc: z.string().optional().default(""),
  bcc: z.string().optional().default(""),
  subject: z.string().optional().default(""),
  text: z.string().max(500_000),
  html: z.string().optional(),
  mailboxId: z.string().min(1).max(128).optional(),
  sendAt: z.string().datetime().or(z.number().int()).optional(),
  draftAttachmentIds: z.array(z.string()).optional().default([]),
  confidential: confidentialSchema,
  /** Recipient sees anon-*@domain; real sender stays on record internally. */
  sendAnonymously: z.boolean().optional().default(false),
});

function splitRecipients(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function validateRecipientList(raw: string, label: string): string[] | Response {
  const parts = splitRecipients(raw);
  const out: string[] = [];
  for (const p of parts) {
    const r = z.string().email().safeParse(p);
    if (!r.success) {
      return NextResponse.json(
        { error: `Invalid ${label}: ${p}` },
        { status: 400 }
      );
    }
    out.push(p);
  }
  return out;
}

function getAppBaseUrl(): string {
  const configured = process.env.APP_BASE_URL?.trim();
  const fallback = "https://sendora.me";
  const base = configured && configured.length > 0 ? configured : fallback;
  return base.replace(/\/+$/, "");
}

function toRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows?: unknown }).rows)
  ) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

function stripHtmlToText(input: string): string {
  const unescaped = input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

  return unescaped
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function insertScheduledEmailJob(input: {
  userId: string;
  toAddr: string;
  ccAddr: string;
  bccAddr: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  mailboxId?: string;
  sendAt: Date;
  status: string;
  sendAnonymously?: boolean;
}): Promise<string> {
  const db = getDb();
  const sendAnonymously = input.sendAnonymously ?? false;

  try {
    const inserted = await db
      .insert(scheduledEmails)
      .values({
        userId: input.userId,
        toAddr: input.toAddr,
        ccAddr: input.ccAddr,
        bccAddr: input.bccAddr,
        subject: input.subject,
        bodyText: input.bodyText,
        bodyHtml: input.bodyHtml,
        mailboxId: input.mailboxId,
        sendAt: input.sendAt,
        status: input.status,
        sendAnonymously,
      })
      .returning({ id: scheduledEmails.id });
    const id = inserted[0]?.id;
    if (id) return id;
  } catch {
    // Fall through to schema-compatible raw insert path below.
  }

  const cols = await db.execute(
    sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'scheduled_emails'
    `
  );
  const columnRows = toRows<{ column_name?: unknown }>(cols);
  if (columnRows.length === 0) {
    throw new Error(
      "scheduled_emails table is missing. Run database migrations (including drizzle/0007_scheduled_emails.sql)."
    );
  }
  const columnSet = new Set(columnRows.map((r) => String(r.column_name ?? "")));
  const ccColumn = columnSet.has("cc_addr")
    ? "cc_addr"
    : columnSet.has("ec_addr")
      ? "ec_addr"
      : null;
  const bccColumn = columnSet.has("bcc_addr")
    ? "bcc_addr"
    : columnSet.has("bec_addr")
      ? "bec_addr"
      : null;

  if (!ccColumn || !bccColumn) {
    throw new Error(
      "scheduled_emails schema mismatch: missing CC/BCC columns (expected cc_addr/bcc_addr or ec_addr/bec_addr)."
    );
  }

  const rawInserted = columnSet.has("send_anonymously")
    ? await db.execute(sql`
    insert into scheduled_emails (
      user_id, to_addr, ${sql.raw(ccColumn)}, ${sql.raw(bccColumn)}, subject, body_text, body_html, mailbox_id, send_at, status, send_anonymously
    ) values (
      ${input.userId}, ${input.toAddr}, ${input.ccAddr}, ${input.bccAddr}, ${input.subject}, ${input.bodyText}, ${input.bodyHtml}, ${input.mailboxId ?? null}, ${input.sendAt}, ${input.status}, ${sendAnonymously}
    )
    returning id
  `)
    : await db.execute(sql`
    insert into scheduled_emails (
      user_id, to_addr, ${sql.raw(ccColumn)}, ${sql.raw(bccColumn)}, subject, body_text, body_html, mailbox_id, send_at, status
    ) values (
      ${input.userId}, ${input.toAddr}, ${input.ccAddr}, ${input.bccAddr}, ${input.subject}, ${input.bodyText}, ${input.bodyHtml}, ${input.mailboxId ?? null}, ${input.sendAt}, ${input.status}
    )
    returning id
  `);

  const row = toRows<{ id?: string }>(rawInserted)[0];
  const id = String((row as { id?: string } | undefined)?.id ?? "");
  if (!id) {
    throw new Error("Failed to insert scheduled email job.");
  }
  return id;
}

export async function POST(request: NextRequest) {
  try {
    logInfo("mail_send_button_request_received");
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

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    logInfo("mail_send_payload_parsed", { userId: user.id });

    const { to, cc, bcc, subject, text, html, mailboxId, draftAttachmentIds } =
      parsed.data;
    const confidential =
      parsed.data.confidential ?? { enabled: false, passcodeMode: "none" as const };
    const sendAnonymously = Boolean(parsed.data.sendAnonymously);

    const toParts = validateRecipientList(to, "To");
    if (toParts instanceof Response) return toParts;
    const ccParts = validateRecipientList(cc, "CC");
    if (ccParts instanceof Response) return ccParts;
    const bccParts = validateRecipientList(bcc, "BCC");
    if (bccParts instanceof Response) return bccParts;

    const messageHtml = html?.trim() ? html : "";
    if (!text.trim() && !messageHtml.trim()) {
      return NextResponse.json(
        { error: "Message cannot be empty." },
        { status: 400 }
      );
    }

    // When HTML is present, derive plain text from HTML so the `text` field
    // never contains raw `<img ...>` markup or other HTML tags.
    const plainText = messageHtml.trim()
      ? stripHtmlToText(messageHtml)
      : stripHtmlToText(text.trim());

    const prefs = await ensureUserSettingsRow(user.id);
    const sigRaw = prefs.signatureHtml?.trim() ?? "";

    let outText = plainText;
    let outHtml = messageHtml;

    if (sigRaw) {
    const sigPlain = sigRaw
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    outText = `${outText}\n\n—\n${sigPlain}`.slice(0, 500_000);
    const sigBlock = `<div class="sendora-signature" style="margin-top:1rem;padding-top:1rem;border-top:1px solid rgba(0,0,0,.08)">${sigRaw}</div>`;
    outHtml = outHtml
      ? `${outHtml}${sigBlock}`
      : `<div>${escapeHtml(outText).replace(/\n/g, "<br/>")}</div>${sigBlock}`;
    }
    logInfo("mail_scheduled_body_mode_debug", {
      userId: user.id,
      hasHtml: Boolean(outHtml?.trim()),
      textLength: outText.length,
      htmlLength: outHtml?.length ?? 0,
    });

  // Load draft attachments so we can embed inline images and persist files.
    const draftRows =
      draftAttachmentIds.length > 0
        ? await getDb()
            .select()
            .from(composeAttachments)
            .where(
              and(
                eq(composeAttachments.userId, user.id),
                inArray(composeAttachments.id, draftAttachmentIds)
              )
            )
        : [];

    const nonImageAttachments: {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    buf: Buffer;
    }[] = [];

    for (const row of draftRows) {
    const keyType = classifyAttachmentStorageKey(row.storageKey);
    if (keyType !== "local") {
      throw new Error(`Attachment "${row.filename}" must be re-uploaded before send`);
    }
    logInfo("mail_scheduled_draft_attachment_read_start", {
      attachmentId: String(row.id),
      filename: row.filename.slice(0, 120),
      storageKey: row.storageKey,
      keyType,
      mimeType: row.mimeType ?? "",
    });
    const buf = await readOutboundAttachmentBuffer(row.storageKey, row.filename);
    const mime = row.mimeType || "application/octet-stream";
    const isImage = mime.toLowerCase().startsWith("image/");
    logInfo("mail_scheduled_draft_attachment_read_ok", {
      attachmentId: String(row.id),
      storageKey: row.storageKey,
      keyType,
      reader: "outbound-local-only",
      filename: row.filename.slice(0, 120),
      contentType: mime,
      sizeBytes: buf.length,
      inlineImage: isImage,
    });
    if (isImage) {
      const src = `/api/mail/draft-attachments/${row.id}`;
      const isInlineReferenced = Boolean(outHtml && outHtml.includes(src));
      if (isInlineReferenced) {
        const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
        outHtml = outHtml.split(src).join(dataUrl);
      } else {
        nonImageAttachments.push({
          id: String(row.id),
          filename: row.filename,
          mimeType: mime,
          sizeBytes: row.sizeBytes,
          storageKey: row.storageKey,
          buf,
        });

        // Image was not inlined; we are sending it as a real attachment.
        // Remove the draft placeholder `<img>` markup from HTML so it cannot
        // show up as raw text in any client.
        if (outHtml) {
          const escapedSrc = src.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );
          const pattern = new RegExp(
            `<img[^>]*src=["']${escapedSrc}["'][^>]*\\/?>(?![^<]*</img>)`,
            "gi"
          );
          outHtml = outHtml.replace(pattern, "");
        }
      }
    } else {
      nonImageAttachments.push({
        id: String(row.id),
        filename: row.filename,
        mimeType: mime,
        sizeBytes: row.sizeBytes,
        storageKey: row.storageKey,
        buf,
      });
    }
    }

    const storageSnapScheduled = await getUserStorageSnapshot(getDb(), user);
    if (isStorageFull(storageSnapScheduled) && nonImageAttachments.length > 0) {
      return NextResponse.json(
        { error: STORAGE_MESSAGE_FULL, code: STORAGE_ERROR_CODE },
        { status: 403 }
      );
    }

    const now = Date.now();
    const sendAtMs =
      typeof parsed.data.sendAt === "number"
        ? parsed.data.sendAt
        : parsed.data.sendAt
          ? new Date(parsed.data.sendAt).getTime()
          : now;

    const sendAt = new Date(sendAtMs);
    const status = "scheduled";

    const confidentialEnabled = process.env.CONFIDENTIAL_EMAIL_ENABLED !== "0";
    logInfo("mail_confidential_flow_check", {
      userId: user.id,
      requested: Boolean(confidential.enabled),
      enabledByConfig: confidentialEnabled,
      entered: Boolean(confidential.enabled && confidentialEnabled),
    });
    if (confidential.enabled && confidentialEnabled) {
    const token = randomUUID();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = confidential.expiresAt
      ? new Date(confidential.expiresAt)
      : new Date(sendAtMs + 7 * 24 * 60 * 60 * 1000); // default 1 week
      try {
        await getDb().insert(confidentialMessages).values({
          ownerUserId: user.id,
          tokenHash,
          subject,
          bodyText: outText,
          bodyHtml: outHtml,
          passcodeMode: confidential.passcodeMode,
          expiresAt,
        });
      } catch {
        logError("mail_confidential_insert_failed_fallback_normal", { userId: user.id });
        // Safety fallback: if confidential storage is unavailable, continue with
        // normal email delivery so regular sending is never blocked.
        // Keep original body content already present in outText/outHtml.
        logInfo("mail_scheduled_insert_attempt", {
          userId: user.id,
          path: "confidential_fallback",
        });
        const scheduledEmailId = await insertScheduledEmailJob({
          userId: user.id,
          toAddr: toParts.join(", "),
          ccAddr: ccParts.join(", "),
          bccAddr: bccParts.join(", "),
          subject,
          bodyText: outText,
          bodyHtml: outHtml,
          mailboxId,
          sendAt,
          status,
          sendAnonymously,
        });
        logInfo("mail_scheduled_insert_success", {
          userId: user.id,
          jobId: scheduledEmailId,
          path: "confidential_fallback",
        });

        for (const a of nonImageAttachments) {
          const { storageKey, sizeBytes } = await saveAttachmentFile(
            user.id,
            scheduledEmailId,
            a.filename,
            a.buf,
            a.mimeType
          );
          await getDb().insert(scheduledEmailAttachments).values({
            scheduledEmailId,
            filename: a.filename.slice(0, 512),
            mimeType: a.mimeType.slice(0, 255),
            sizeBytes,
            storageKey,
          });
        }

        return NextResponse.json({
          ok: true,
          id: scheduledEmailId,
          sendAt: sendAt.toISOString(),
          confidentialDisabled: true,
        });
      }

    const linkUrl = `${getAppBaseUrl()}/c/${token}`;
    const expiresLabel = expiresAt.toISOString().slice(0, 10);
    outText = [
      "This is a confidential message.",
      "",
      `Open securely: ${linkUrl}`,
      "",
      `Expires: ${expiresLabel}`,
    ].join("\n");
    outHtml = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5">
        <h2 style="margin:0 0 8px 0;font-size:16px">Confidential message</h2>
        <p style="margin:0 0 14px 0;color:rgba(0,0,0,0.7)">This message is available via a secure link.</p>
        <p style="margin:0 0 14px 0">
          <a href="${linkUrl}" style="display:inline-block;background:#6d4aff;color:white;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:600">
            Open confidential message
          </a>
        </p>
        <p style="margin:0;color:rgba(0,0,0,0.55);font-size:12px">Expires: ${expiresLabel}</p>
      </div>
    `.trim();
    }

    // Insert scheduled job first so we have an id for attachment storage.
    logInfo("mail_scheduled_insert_attempt", { userId: user.id, path: "standard" });
    const scheduledEmailId = await insertScheduledEmailJob({
      userId: user.id,
      toAddr: toParts.join(", "),
      ccAddr: ccParts.join(", "),
      bccAddr: bccParts.join(", "),
      subject,
      bodyText: outText,
      bodyHtml: outHtml,
      mailboxId,
      sendAt,
      status,
      sendAnonymously,
    });
    logInfo("mail_scheduled_insert_success", {
      userId: user.id,
      jobId: scheduledEmailId,
      path: "standard",
    });

  // Persist non-image attachments for later sending.
    for (const a of nonImageAttachments) {
    const { storageKey, sizeBytes } = await saveAttachmentFile(
      user.id,
      scheduledEmailId,
      a.filename,
      a.buf,
      a.mimeType
    );
    await getDb().insert(scheduledEmailAttachments).values({
      scheduledEmailId,
      filename: a.filename.slice(0, 512),
      mimeType: a.mimeType.slice(0, 255),
      sizeBytes,
      storageKey,
    });
    }

    return NextResponse.json({
      ok: true,
      id: scheduledEmailId,
      sendAt: sendAt.toISOString(),
    });
  } catch (e) {
    logError("mail_scheduled_send_failed", {
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Send failed" },
      { status: 500 }
    );
  }
}

