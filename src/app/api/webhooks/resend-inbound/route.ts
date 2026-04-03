import { NextRequest, NextResponse } from "next/server";
import type { AttachmentData } from "resend";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attachments, messageLabels, messages } from "@/db/schema";
import { getEmailDomain } from "@/lib/constants";
import { saveAttachmentFile } from "@/lib/attachments-storage";
import {
  extractEmailAddress,
  deriveMailAuthMetadata,
  getInReplyToFromHeaders,
  ingestInboundMessage,
  resolveInboundThreadId,
  resolveInternalRecipientUserId,
  storeUnclaimedTempInboxMessage,
} from "@/lib/email-message";
import {
  getInboundDisposition,
  isSenderBlocked,
} from "@/lib/inbound-policy";
import { resolveExternalInboundFolder } from "@/lib/spam-inbound-resolution";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { stripTrackingFromHtml } from "@/lib/mail-filter";
import {
  downloadFromSignedUrl,
  fetchReceivedEmail,
  listReceivingAttachments,
  verifyResendWebhook,
} from "@/lib/resend-mail";
import { recordAdminActivity } from "@/lib/admin-activity";
import { ensureUserSettingsRow } from "@/lib/user-settings";
import {
  getUserStorageSnapshotByUserId,
  isStorageFull,
  mailboxMessageContentBytesExpr,
} from "@/lib/storage-quota";
import { getAdminSystemSettings } from "@/lib/admin-system-settings";
import { runInboundAutomation } from "@/lib/email-automation";
import { createUserNotification } from "@/lib/app-notifications";

export const runtime = "nodejs";

function svixHeadersFromRequest(request: NextRequest): {
  id: string;
  timestamp: string;
  signature: string;
} {
  return {
    id: request.headers.get("svix-id") ?? "",
    timestamp: request.headers.get("svix-timestamp") ?? "",
    signature: request.headers.get("svix-signature") ?? "",
  };
}

function uniqueAddressList(to: string[], cc: string[], bcc: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...to, ...cc, ...bcc]) {
    const norm = extractEmailAddress(raw);
    if (!norm.includes("@")) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(raw.trim());
  }
  return out;
}

function plainTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAddressHeaderList(val: string | undefined): string[] {
  if (!val) return [];
  // Split on commas; works well for "Name <addr>, Name2 <addr2>" formats.
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Coerce string | string[] → string[] for Resend's received email fields. */
function toArray(val: string | string[] | undefined | null): string[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

export async function POST(request: NextRequest) {
  const settings = await getAdminSystemSettings();
  logInfo("resend_webhook_received", { url: request.url });

  let payload: string;
  try {
    payload = await request.text();
  } catch {
    logError("resend_webhook_body_read_failed");
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const svix = svixHeadersFromRequest(request);
  logInfo("resend_webhook_svix_check", {
    hasId: Boolean(svix.id),
    hasTimestamp: Boolean(svix.timestamp),
    hasSignature: Boolean(svix.signature),
  });

  if (!svix.id || !svix.timestamp || !svix.signature) {
    logWarn("resend_webhook_missing_svix_headers");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let event: ReturnType<typeof verifyResendWebhook>;
  try {
    event = verifyResendWebhook(payload, svix);
  } catch (e) {
    logWarn("resend_webhook_verify_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  logInfo("resend_webhook_event_type", { type: event.type });

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true, skipped: event.type });
  }

  const { email_id: emailId } = event.data;
  const fromRaw: string =
    typeof event.data.from === "string"
      ? event.data.from
      : Array.isArray(event.data.from)
      ? (event.data.from[0] ?? "")
      : "";

  const domain = getEmailDomain().toLowerCase();
  logInfo("resend_webhook_inbound_start", { emailId, domain });

  let full;
  try {
    full = await fetchReceivedEmail(emailId);
    logInfo("resend_webhook_fetched_email", {
      subject: full.subject ?? "",
      from: String(full.from ?? ""),
      toCount: toArray(full.to).length,
    });
  } catch (e) {
    logError("resend_inbound_fetch_failed", {
      message: e instanceof Error ? e.message : "unknown",
      emailId,
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const toArr = toArray(full.to ?? event.data.to);
  const ccArr = toArray(full.cc ?? event.data.cc);
  const bccArr = toArray(full.bcc ?? event.data.bcc);

  // Fallback: Resend sometimes doesn't populate `full.to/cc/bcc` reliably for
  // receiving events; parse from headers too.
  const headers = full.headers as Record<string, string> | null | undefined;
  const headerTo = Object.entries(headers ?? {}).find(
    ([k]) => k.toLowerCase() === "to"
  )?.[1];
  const headerCc = Object.entries(headers ?? {}).find(
    ([k]) => k.toLowerCase() === "cc"
  )?.[1];
  const headerBcc = Object.entries(headers ?? {}).find(
    ([k]) => k.toLowerCase() === "bcc"
  )?.[1];

  const recipientRaws = uniqueAddressList(
    [...toArr, ...parseAddressHeaderList(headerTo)],
    [...ccArr, ...parseAddressHeaderList(headerCc)],
    [...bccArr, ...parseAddressHeaderList(headerBcc)]
  );

  logInfo("resend_webhook_recipients", {
    count: recipientRaws.length,
    list: recipientRaws.slice(0, 10).join(", "),
    domain,
  });

  const matchingUsers: { userId: string; toAddr: string; localPart: string }[] =
    [];
  const seenUserIds = new Set<string>();
  const unclaimedTempRecipients: { toAddr: string; localPart: string }[] = [];
  const seenUnclaimed = new Set<string>();
  for (const raw of recipientRaws) {
    const addr = extractEmailAddress(raw);

    const at = addr.indexOf("@");
    const localPart = at > 0 ? addr.slice(0, at) : addr;
    const recipDomain = at > 0 ? addr.slice(at + 1).toLowerCase() : "";

    const userId = await resolveInternalRecipientUserId(raw);
    if (!userId) {
      if (recipDomain === domain) {
        if (!seenUnclaimed.has(addr)) {
          seenUnclaimed.add(addr);
          unclaimedTempRecipients.push({ toAddr: addr, localPart });
        }
      }
      logInfo("resend_webhook_unmatched_recipient", { addr, domain });
      continue;
    }
    if (seenUserIds.has(userId)) continue;
    seenUserIds.add(userId);
    logInfo("resend_webhook_matched_user", { localPart, userId });
    matchingUsers.push({ userId, toAddr: addr, localPart });
  }

  if (matchingUsers.length === 0 && unclaimedTempRecipients.length === 0) {
    logWarn("resend_webhook_no_matching_users", {
      recipients: recipientRaws.join(", "),
      domain,
    });
    return NextResponse.json({ ok: true });
  }

  const subject = full.subject ?? event.data.subject ?? "";
  const fromAddr =
    fromRaw ||
    (typeof full.from === "string" ? full.from : toArray(full.from)[0]) ||
    "(unknown)";
  const authMeta = deriveMailAuthMetadata(headers, fromAddr);
  const messageIdForDedup =
    full.message_id || event.data.message_id || emailId;

  const bodyText = (full.text ?? "").trim();
  const bodyHtml =
    typeof full.html === "string" && full.html.trim() ? full.html : undefined;

  const inReplyTo = getInReplyToFromHeaders(
    full.headers as Record<string, string> | null | undefined
  );
  const ccJoined = ccArr.map(extractEmailAddress).join(", ");

  logInfo("resend_webhook_processing", {
    subject,
    fromAddr,
    messageId: messageIdForDedup,
    hasHtml: Boolean(bodyHtml),
    inReplyTo: inReplyTo ?? "",
  });

  try {
    let attachmentMeta: AttachmentData[];
    try {
      attachmentMeta = await listReceivingAttachments(emailId);
      logInfo("resend_webhook_attachments", { count: attachmentMeta.length });
    } catch (e) {
      logWarn("resend_inbound_attachments_list_failed", {
        message: e instanceof Error ? e.message : "unknown",
      });
      attachmentMeta = [];
    }

    const attachmentBuffers: { filename: string; mime: string; buf: Buffer }[] =
      [];
    for (const att of attachmentMeta) {
      try {
        const buf = await downloadFromSignedUrl(att.download_url);
        attachmentBuffers.push({
          filename: (att.filename ?? "attachment").slice(0, 512),
          mime: (att.content_type || "application/octet-stream").slice(0, 255),
          buf,
        });
      } catch (dlErr) {
        logError("resend_inbound_attachment_download_failed", {
          message: dlErr instanceof Error ? dlErr.message : "unknown",
          emailId,
        });
      }
    }
    const attachmentCount = attachmentBuffers.length;

    const unclaimedBodyText =
      bodyText || (bodyHtml ? plainTextFromHtml(bodyHtml) : "") || subject;

    for (const { userId, toAddr } of matchingUsers) {
      if (await isSenderBlocked(userId, fromAddr)) {
        logInfo("resend_webhook_sender_blocked", { userId, fromAddr });
        continue;
      }

      const storageSnap = await getUserStorageSnapshotByUserId(getDb(), userId);
      const skipInboundAttachments =
        storageSnap != null && isStorageFull(storageSnap);
      if (skipInboundAttachments && attachmentCount > 0) {
        logWarn("resend_inbound_attachments_skipped_storage_full", {
          userId,
          attachmentCount,
        });
      }

      const userSettings = await ensureUserSettingsRow(userId);
      let userHtml = bodyHtml;
      if (userHtml) {
        userHtml = stripTrackingFromHtml(userHtml, {
          blockTrackers: userSettings.blockTrackers,
          externalImages: userSettings.externalImages as "always" | "ask" | "never",
        });
      }
      const userBodyText =
        bodyText ||
        (userHtml ? plainTextFromHtml(userHtml) : "") ||
        (subject ? `(no body) ${subject}` : "(no body)");

      const [inboxTextRows, inboxAttRows] = await Promise.all([
        getDb()
          .select({
            bytes: mailboxMessageContentBytesExpr(messages),
          })
          .from(messages)
          .where(
            and(
              eq(messages.userId, userId),
              inArray(messages.folder, ["inbox", "spam"])
            )
          ),
        getDb()
          .select({
            bytes: sql<number>`coalesce(sum(${attachments.sizeBytes}), 0)::bigint`,
          })
          .from(attachments)
          .innerJoin(messages, eq(attachments.messageId, messages.id))
          .where(
            and(
              eq(messages.userId, userId),
              inArray(messages.folder, ["inbox", "spam"])
            )
          ),
      ]);
      const inboxTextBytes = inboxTextRows.reduce(
        (sum, r) => sum + Number(r.bytes ?? 0),
        0
      );
      const inboxAttBytes = Number(inboxAttRows[0]?.bytes ?? 0);
      const incomingBytes =
        Buffer.byteLength(subject, "utf8") +
        Buffer.byteLength(userBodyText, "utf8") +
        Buffer.byteLength(userHtml ?? "", "utf8") +
        attachmentBuffers.reduce((s, a) => s + a.buf.length, 0);
      if (inboxTextBytes + inboxAttBytes + incomingBytes > settings.limits.maxInboxSizeBytes) {
        logWarn("resend_inbound_skipped_inbox_limit", {
          userId,
          maxInboxSizeBytes: settings.limits.maxInboxSizeBytes,
        });
        continue;
      }

      const threadId = await resolveInboundThreadId(userId, inReplyTo);
      const disposition = await getInboundDisposition(userId, fromAddr);
      const attNames = attachmentBuffers.map((a) => a.filename);

      // Spam scoring must never block mail ingestion.
      let inboundResolved: Awaited<
        ReturnType<typeof resolveExternalInboundFolder>
      >;
      try {
        inboundResolved = await resolveExternalInboundFolder({
          userId,
          fromAddr,
          subject,
          bodyText: userBodyText,
          bodyHtml: userHtml,
          attachmentFilenames: attNames,
          disposition,
        });
      } catch (spamErr) {
        logError("spam_inbound_scoring_failed", {
          message:
            spamErr instanceof Error ? spamErr.message : "unknown",
          userId,
          fromAddr,
          subject: subject?.slice(0, 120) ?? "",
        });
        inboundResolved = {
          folder: disposition.kind === "trash" ? "trash" : "inbox",
          spamScore: 0,
          spamReasons: [],
          applyLabelId:
            disposition.kind === "label" ? disposition.labelId : null,
        };
      }

      const targetFolder = inboundResolved.folder;

      const persistInboundAttachments =
        attachmentCount > 0 && !skipInboundAttachments;

      logInfo("resend_webhook_ingesting", { userId, targetFolder, threadId });

      try {
        const { id: messageIdRow, created, tempInbox } = await ingestInboundMessage({
          providerMessageId: messageIdForDedup,
          userId,
          subject,
          bodyText: userBodyText,
          bodyHtml: userHtml,
          fromAddr,
          toAddr,
          inReplyTo,
          ccAddr: ccJoined,
          threadId,
          hasAttachment: persistInboundAttachments,
          folder: targetFolder,
          mailedBy: authMeta.mailedBy,
          signedBy: authMeta.signedBy,
          spamScore: inboundResolved.spamScore,
        });

        logInfo("resend_webhook_ingested", { userId, messageIdRow, created });

        if (created && !tempInbox) {
          void createUserNotification({
            userId,
            type: "new_email",
            title: "New email",
            body: subject.slice(0, 240),
            meta: { messageId: messageIdRow },
          });
          void runInboundAutomation({
            ownerUserId: userId,
            messageId: messageIdRow,
            fromAddr,
            subject,
            bodyText: userBodyText,
            bodyHtml: userHtml,
          });
        }

        if (created && inboundResolved.applyLabelId) {
          try {
            await getDb().insert(messageLabels).values({
              messageId: messageIdRow,
              labelId: inboundResolved.applyLabelId,
            });
          } catch {
            /* ignore duplicate / constraint */
          }
        }

        if (created && persistInboundAttachments) {
          for (const a of attachmentBuffers) {
            try {
              const { storageKey, sizeBytes } = await saveAttachmentFile(
                userId,
                messageIdRow,
                a.filename,
                a.buf,
                a.mime
              );
              await getDb().insert(attachments).values({
                messageId: messageIdRow,
                filename: a.filename,
                mimeType: a.mime,
                sizeBytes,
                storageKey,
              });
            } catch (attErr) {
              logError("resend_inbound_attachment_failed", {
                message: attErr instanceof Error ? attErr.message : "unknown",
                emailId,
              });
            }
          }
          await getDb()
            .update(messages)
            .set({ hasAttachment: true })
            .where(eq(messages.id, messageIdRow));
        }
      } catch (ingestErr) {
        const errMsg =
          ingestErr instanceof Error ? ingestErr.message : String(ingestErr);
        logError("resend_webhook_ingest_failed", {
          message: errMsg,
          userId,
        });
        void recordAdminActivity({
          eventType: "inbound_email_failure",
          severity: "error",
          actorUserId: userId,
          detail: "Inbound message could not be saved to the database.",
          meta: { emailId, message: errMsg.slice(0, 500) },
        });
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }
    }

    // Catch-all for temporary inbox: store OTP-focused messages for any
    // `*@sendora.me` address we couldn't map to a user mailbox.
    if (unclaimedTempRecipients.length > 0) {
      for (const { toAddr } of unclaimedTempRecipients) {
        try {
          await storeUnclaimedTempInboxMessage({
            emailAddress: toAddr,
            providerMessageId: messageIdForDedup,
            fromAddr,
            subject,
            bodyText: unclaimedBodyText,
          });
        } catch (err) {
          logError("resend_webhook_unclaimed_store_failed", {
            message:
              err instanceof Error ? err.message : "unknown",
            toAddr,
            emailId,
          });
        }
      }
    }
  } catch (e) {
    logError("resend_webhook_outer_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  logInfo("resend_webhook_done", { matchedUsers: matchingUsers.length });
  return NextResponse.json({ ok: true });
}
