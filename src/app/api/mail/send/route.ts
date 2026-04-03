import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { and, count, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { anonymousSendAliases, attachments, composeAttachments, composeDrafts, messages } from "@/db/schema";
import {
  formatAnonymousOutboundFrom,
  generateAnonymousAliasLocalPart,
} from "@/lib/anonymous-send";
import {
  classifyAttachmentStorageKey,
  readOutboundAttachmentBuffer,
  saveAttachmentFile,
} from "@/lib/attachments-storage";
import { getCurrentUser } from "@/lib/session";
import {
  ingestInboundMessage,
  persistSentMessage,
  resolveInboundThreadId,
  resolveInternalRecipientUserId,
} from "@/lib/email-message";
import { resolveSendFromForUser } from "@/lib/mail-from";
import {
  isResendConfigured,
  sendOutboundMail,
  serializeOutboundAttachment,
} from "@/lib/resend-mail";
import { convertInlineDataUrlsToCid } from "@/lib/inline-dataurl-to-cid";
import { rateLimitSend } from "@/lib/rate-limit";
import { logError, logInfo } from "@/lib/logger";
import { recordAdminActivity } from "@/lib/admin-activity";
import { ensureUserSettingsRow } from "@/lib/user-settings";
import {
  STORAGE_ERROR_CODE,
  STORAGE_MESSAGE_FULL,
  getUserStorageSnapshot,
  isStorageFull,
} from "@/lib/storage-quota";
import { getAdminSystemSettings } from "@/lib/admin-system-settings";
import { enforceApiUsageLimitForUser } from "@/lib/api-usage-limit";

const sendJsonSchema = z.object({
  to: z.string().email(),
  cc: z.string().optional().default(""),
  bcc: z.string().optional().default(""),
  subject: z.string().max(998).default(""),
  text: z.string().max(500_000),
  html: z.string().max(500_000).optional(),
  mailboxId: z.string().min(1).max(128).optional(),
  draftAttachmentIds: z.array(z.string()).optional().default([]),
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
  for (const p of parts) {
    const r = z.string().email().safeParse(p);
    if (!r.success) {
      return NextResponse.json(
        { error: `Invalid ${label}: ${p}` },
        { status: 400 }
      );
    }
  }
  return parts;
}

function stripHtmlToText(input: string): string {
  const unescaped = input
    // Some clients/frontends may HTML-escape message bodies; decode angle brackets
    // so the tag-stripping regex can remove markup safely for plain text.
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

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await getAdminSystemSettings();
  const apiLimit = await enforceApiUsageLimitForUser(user.id);
  if (!apiLimit.allowed) {
    return NextResponse.json(
      { error: "API request limit reached for today." },
      { status: 429 }
    );
  }

  const { success } = await rateLimitSend(user.id);
  if (!success) {
    return NextResponse.json(
      { error: "Send limit reached. Try again later." },
      { status: 429 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  let toAddr = "";
  let ccRaw = "";
  let bccRaw = "";
  let subject = "";
  let text = "";
  let html: string | undefined;
  let mailboxId: string | undefined;
  let draftAttachmentIds: string[] = [];
  let sendAnonymously = false;
  const uploadFiles: File[] = [];

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    toAddr = String(form.get("to") ?? "");
    ccRaw = String(form.get("cc") ?? "");
    bccRaw = String(form.get("bcc") ?? "");
    subject = String(form.get("subject") ?? "");
    text = String(form.get("text") ?? "");
    const htmlField = form.get("html");
    if (typeof htmlField === "string" && htmlField.trim()) html = htmlField;
    const mb = form.get("mailboxId");
    if (typeof mb === "string" && mb.trim()) mailboxId = mb.trim();
    const anon = form.get("sendAnonymously");
    sendAnonymously = anon === "1" || anon === "true";
    for (const [key, val] of form.entries()) {
      if (val instanceof File && val.size > 0 && key === "attachments") {
        uploadFiles.push(val);
      }
    }
  } else {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = sendJsonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    toAddr = parsed.data.to;
    ccRaw = parsed.data.cc;
    bccRaw = parsed.data.bcc;
    subject = parsed.data.subject;
    text = parsed.data.text;
    html = parsed.data.html;
    mailboxId = parsed.data.mailboxId;
    draftAttachmentIds = parsed.data.draftAttachmentIds ?? [];
    sendAnonymously = Boolean(parsed.data.sendAnonymously);
  }

  const toOk = z.string().email().safeParse(toAddr);
  if (!toOk.success) {
    return NextResponse.json({ error: "Invalid To address" }, { status: 400 });
  }
  const ccList = validateRecipientList(ccRaw, "CC");
  if (ccList instanceof Response) return ccList;
  const bccList = validateRecipientList(bccRaw, "BCC");
  if (bccList instanceof Response) return bccList;

  if (!text.trim() && !html?.trim()) {
    return NextResponse.json(
      { error: "Message cannot be empty." },
      { status: 400 }
    );
  }

  const sentTodayRows = await getDb()
    .select({ c: count() })
    .from(messages)
    .where(
      and(
        eq(messages.userId, user.id),
        eq(messages.folder, "sent"),
        gte(messages.createdAt, new Date(new Date().setUTCHours(0, 0, 0, 0)))
      )
    );
  if (Number(sentTodayRows[0]?.c ?? 0) >= settings.limits.maxEmailsPerDayPerUser) {
    return NextResponse.json(
      { error: "Daily email sending limit reached." },
      { status: 429 }
    );
  }

  const rawText = text.trim();
  const sourceHtml = html?.trim() ? html : undefined;
  // When HTML is present, derive plain text from the HTML so the `text` field
  // never accidentally contains raw `<img ...>` or other markup.
  const plainText = sourceHtml
    ? stripHtmlToText(sourceHtml)
    : stripHtmlToText(rawText);

  const prefs = await ensureUserSettingsRow(user.id);
  const sigRaw = prefs.signatureHtml?.trim() ?? "";
  let outText = plainText;
  let outHtml = sourceHtml;
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
  logInfo("mail_body_mode_debug", {
    userId: user.id,
    hasHtml: Boolean(outHtml?.trim()),
    textLength: outText.length,
    htmlLength: outHtml?.length ?? 0,
  });

  const aliasLocalPart = sendAnonymously ? generateAnonymousAliasLocalPart() : null;
  const { from, replyTo } =
    sendAnonymously && aliasLocalPart
      ? formatAnonymousOutboundFrom(aliasLocalPart)
      : await resolveSendFromForUser({
          user,
          mailboxId: sendAnonymously ? null : (mailboxId ?? null),
        });
  if (!mailboxId && !sendAnonymously) {
    const requiredDomain = settings.email.defaultSendingDomain.toLowerCase();
    if (!from.toLowerCase().includes(`@${requiredDomain}`)) {
      return NextResponse.json(
        { error: `Default sender domain must be ${requiredDomain}.` },
        { status: 400 }
      );
    }
  }
  const ccJoined = ccList.join(", ");
  const bccJoined = bccList.join(", ");

  try {
    const filePayload =
      uploadFiles.length > 0
        ? await Promise.all(
            uploadFiles.map(async (f) => {
                if (f.size > settings.email.maxAttachmentSizeBytes) {
                  throw new Error("Attachment exceeds configured size limit.");
                }
                const buf = Buffer.from(await f.arrayBuffer()) as unknown as Buffer<ArrayBufferLike>;
              return {
                file: f,
                buf,
                  outbound: serializeOutboundAttachment({
                    filename: f.name,
                    content: buf,
                    contentType: f.type || "application/octet-stream",
                  }),
              };
            })
          )
        : [];

    // Draft attachments (images + files) are referenced by id from the compose editor.
    // For images inserted inline into HTML, we embed them as data URLs so internal
    // and external inbox rendering works without `cid:` or authenticated endpoints.
    const attachmentWarnings: string[] = [];
    if (draftAttachmentIds.length > 0) {
      const draftRows = await getDb()
        .select()
        .from(composeAttachments)
        .where(
          and(
            eq(composeAttachments.userId, user.id),
            inArray(composeAttachments.id, draftAttachmentIds)
          )
        );

      for (const row of draftRows) {
        if (Number(row.sizeBytes ?? 0) > settings.email.maxAttachmentSizeBytes) {
          return NextResponse.json(
            { error: `Attachment "${row.filename}" exceeds configured size limit.` },
            { status: 400 }
          );
        }
        const keyType = classifyAttachmentStorageKey(row.storageKey);
        let buf: Buffer;
        try {
          // Resend attachment typing is sensitive to Node Buffer generic params.
          // We only read local bytes at send-time; this cast normalizes the compile-time
          // Buffer generic to match the `uploadFiles` path type inference.
          buf = await readOutboundAttachmentBuffer(row.storageKey, row.filename);
        } catch (attachErr) {
          const warnMsg = `Attachment "${row.filename}" could not be loaded and was skipped.`;
          logError("attachment_read_failed_skipped", {
            attachmentId: String(row.id),
            storageKey: row.storageKey,
            keyType,
            reader: "outbound-local-only",
            filename: row.filename,
            mimeType: row.mimeType ?? "",
            error: attachErr instanceof Error ? attachErr.message : String(attachErr),
          });
          attachmentWarnings.push(warnMsg);
          continue;
        }

        const mime = row.mimeType || "application/octet-stream";
        const isImage = mime.toLowerCase().startsWith("image/");
        logInfo("attachment_read_for_send_ok", {
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
          // Only inline images that are actually referenced in the HTML body.
          if (isInlineReferenced && outHtml) {
            const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
            outHtml = outHtml.split(src).join(dataUrl);
            continue;
          }

          // If the image is not inlined, we are sending it as a regular attachment.
          // Remove the draft placeholder markup from HTML so it can't appear as raw `<img>` output.
          if (outHtml) {
            const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const pattern = new RegExp(
              `<img[^>]*src=["']${escapedSrc}["'][^>]*\\/?>(?![^<]*</img>)`,
              "gi"
            );
            outHtml = outHtml.replace(pattern, "");
          }
        }

        // Non-image files and non-inline images are sent as regular attachments.
        filePayload.push({
          file: { name: row.filename, type: mime } as unknown as File,
          buf,
          outbound: serializeOutboundAttachment({
            filename: row.filename,
            content: buf,
            contentType: mime,
          }),
        });
      }
    }

    const storageSnap = await getUserStorageSnapshot(getDb(), user);
    if (isStorageFull(storageSnap) && filePayload.length > 0) {
      return NextResponse.json(
        { error: STORAGE_MESSAGE_FULL, code: STORAGE_ERROR_CODE },
        { status: 403 }
      );
    }
    const totalAttachmentBytes = filePayload.reduce((sum, p) => sum + p.buf.length, 0);
    const messageBytes =
      Buffer.byteLength(subject || "", "utf8") +
      Buffer.byteLength(outText || "", "utf8") +
      Buffer.byteLength(outHtml || "", "utf8") +
      totalAttachmentBytes;
    if (messageBytes > settings.email.maxEmailSizeBytes) {
      return NextResponse.json(
        { error: "Email size exceeds configured maximum." },
        { status: 400 }
      );
    }

    // --- Internal delivery: default domain or verified custom mailbox ---
    const internalRecipientId = await resolveInternalRecipientUserId(toAddr);
    let providerId: string;

    if (internalRecipientId) {
      const recipientUser = { id: internalRecipientId };

        // Assign a shared message ID for dedup
        providerId = `internal-${randomUUID()}`;

        // Persist to sender's sent folder
        const senderMessageId = await persistSentMessage({
          userId: user.id,
          providerMessageId: providerId,
          subject,
          bodyText: outText,
          bodyHtml: outHtml,
          fromAddr: from,
          toAddr,
          ccAddr: ccJoined,
          bccAddr: bccJoined,
          hasAttachment: filePayload.length > 0,
          sentAnonymously: Boolean(sendAnonymously && aliasLocalPart),
        });
        if (sendAnonymously && aliasLocalPart) {
          await getDb().insert(anonymousSendAliases).values({
            userId: user.id,
            aliasLocalPart,
            messageId: senderMessageId,
          });
        }

        // Deliver directly to recipient's inbox (skip Resend entirely)
        const recipientThreadId = await resolveInboundThreadId(
          recipientUser.id,
          null
        );
        await ingestInboundMessage({
          providerMessageId: `${providerId}-recv`,
          userId: recipientUser.id,
          subject,
          bodyText: outText,
          bodyHtml: outHtml,
          fromAddr: from,
          toAddr,
          ccAddr: ccJoined,
          threadId: recipientThreadId,
          hasAttachment: filePayload.length > 0,
          folder: "inbox",
        });

        // Save attachments for the sender's sent message
        for (const { file: f, buf } of filePayload) {
          const { storageKey, sizeBytes } = await saveAttachmentFile(
            user.id,
            senderMessageId,
            f.name,
            buf,
            f.type || "application/octet-stream"
          );
          await getDb().insert(attachments).values({
            messageId: senderMessageId,
            filename: f.name.slice(0, 512),
            mimeType: (f.type || "application/octet-stream").slice(0, 255),
            sizeBytes,
            storageKey,
          });
        }

        await getDb()
          .delete(composeDrafts)
          .where(eq(composeDrafts.userId, user.id));

        // Cleanup draft attachments after a successful send.
        await getDb()
          .delete(composeAttachments)
          .where(eq(composeAttachments.userId, user.id));

        logInfo("mail_sent_internal", { userId: user.id, to: toAddr, attachmentWarnings: attachmentWarnings.join("; ") });
        return NextResponse.json({
          ok: true,
          id: providerId,
          ...(attachmentWarnings.length > 0 ? { warnings: attachmentWarnings } : {}),
        });
    }

    // --- External delivery via Resend ---
    if (!isResendConfigured()) {
      return NextResponse.json(
        { error: "Email sending is not configured on this server." },
        { status: 503 }
      );
    }

    const externalInlineConversion = outHtml?.trim()
      ? convertInlineDataUrlsToCid(outHtml)
      : {
          html: outHtml ?? "",
          inlineAttachments: [] as ReturnType<
            typeof convertInlineDataUrlsToCid
          >["inlineAttachments"],
          convertedCount: 0,
          remainingDraftAttachmentImgSrcCount: 0,
        };

    // Safety net: external mail clients cannot resolve our internal draft URL.
    const externalHtmlCleaned =
      externalInlineConversion.remainingDraftAttachmentImgSrcCount > 0
        ? externalInlineConversion.html.replace(
            /<img[^>]*src=["'][^"']*\/api\/mail\/draft-attachments\/[^"']*["'][^>]*>/gi,
            ""
          )
        : externalInlineConversion.html;

    const regularOutboundAttachments =
      filePayload.length > 0 ? filePayload.map((p) => p.outbound) : [];
    const allOutboundAttachments = [
      ...regularOutboundAttachments,
      ...(externalInlineConversion.inlineAttachments ?? []),
    ];

    const { id } = await sendOutboundMail({
      from,
      replyTo,
      to: toAddr,
      cc: ccList.length ? ccList : undefined,
      bcc: bccList.length ? bccList : undefined,
      subject,
      text: outText.slice(0, 500_000),
      html: outHtml?.trim() ? externalHtmlCleaned : undefined,
      attachments: allOutboundAttachments.length ? allOutboundAttachments : undefined,
    });
    providerId = id || `sent-${randomUUID()}`;
    const messageId = await persistSentMessage({
      userId: user.id,
      providerMessageId: providerId,
      subject,
      bodyText: outText,
      bodyHtml: outHtml,
      fromAddr: from,
      toAddr,
      ccAddr: ccJoined,
      bccAddr: bccJoined,
      hasAttachment: filePayload.length > 0,
      sentAnonymously: Boolean(sendAnonymously && aliasLocalPart),
    });
    if (sendAnonymously && aliasLocalPart) {
      await getDb().insert(anonymousSendAliases).values({
        userId: user.id,
        aliasLocalPart,
        messageId,
      });
    }

    for (const { file: f, buf } of filePayload) {
      const { storageKey, sizeBytes } = await saveAttachmentFile(
        user.id,
        messageId,
        f.name,
        buf,
        f.type || "application/octet-stream"
      );
      await getDb().insert(attachments).values({
        messageId,
        filename: f.name.slice(0, 512),
        mimeType: (f.type || "application/octet-stream").slice(0, 255),
        sizeBytes,
        storageKey,
      });
    }

    await getDb()
      .delete(composeDrafts)
      .where(eq(composeDrafts.userId, user.id));

    // Cleanup draft attachments after a successful send.
    await getDb()
      .delete(composeAttachments)
      .where(eq(composeAttachments.userId, user.id));

    logInfo("mail_sent", { userId: user.id, attachmentWarnings: attachmentWarnings.join("; ") });
    return NextResponse.json({
      ok: true,
      id: providerId,
      ...(attachmentWarnings.length > 0 ? { warnings: attachmentWarnings } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const resendCode =
      e instanceof Error && "resendCode" in e && typeof (e as { resendCode?: string }).resendCode === "string"
        ? (e as { resendCode: string }).resendCode
        : undefined;
    logError("mail_send_failed", {
      message: msg,
      resendCode: resendCode ?? "",
      fromUsed: from,
    });
    await recordAdminActivity({
      eventType: "email_delivery_failure",
      severity: "error",
      actorUserId: user.id,
      detail: "Outbound email send failed.",
      meta: { resendCode: resendCode ?? null, message: msg.slice(0, 300) },
    });
    const exposeDetail =
      process.env.NODE_ENV === "development" ||
      process.env.RESEND_EXPOSE_ERRORS === "1";
    return NextResponse.json(
      {
        error: exposeDetail
          ? msg
          : "Could not send message. Check server logs and Resend domain/sender settings.",
        ...(exposeDetail && resendCode ? { resendCode } : {}),
      },
      { status: 502 }
    );
  }
}
