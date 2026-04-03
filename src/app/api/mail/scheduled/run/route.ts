import { NextRequest, NextResponse } from "next/server";
import { and, eq, lte } from "drizzle-orm";
import { getDb } from "@/db";
import {
  anonymousSendAliases,
  composeAttachments,
  composeDrafts,
  attachments,
  messages,
  scheduledEmailAttachments,
  scheduledEmails,
  scheduledReminders,
  users,
} from "@/db/schema";
import {
  formatAnonymousOutboundFrom,
  generateAnonymousAliasLocalPart,
} from "@/lib/anonymous-send";
import {
  classifyAttachmentStorageKey,
  readOutboundAttachmentBuffer,
  saveAttachmentFile,
} from "@/lib/attachments-storage";
import {
  ingestInboundMessage,
  normalizeMessageId,
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
import { createUserNotification } from "@/lib/app-notifications";

export const runtime = "nodejs";

function splitRecipients(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

async function loadUser(userId: string) {
  const [u] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  return u ?? null;
}

async function ensureSenderMessage({
  user,
  providerMessageId,
  subject,
  bodyText,
  bodyHtml,
  fromAddr,
  toAddr,
  ccAddr,
  bccAddr,
  hasAttachment,
  sentAnonymously,
}: {
  user: typeof users.$inferSelect;
  providerMessageId: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  fromAddr: string;
  toAddr: string;
  ccAddr: string;
  bccAddr: string;
  hasAttachment: boolean;
  sentAnonymously: boolean;
}): Promise<string> {
  const normPid = normalizeMessageId(providerMessageId).slice(0, 512);
  const existing = await getDb()
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.userId, user.id), eq(messages.providerMessageId, normPid)))
    .limit(1);
  if (existing.length > 0) return existing[0]!.id;

  return await persistSentMessage({
    userId: user.id,
    providerMessageId,
    subject,
    bodyText,
    bodyHtml,
    fromAddr,
    toAddr,
    ccAddr,
    bccAddr,
    hasAttachment,
    sentAnonymously,
  });
}

async function saveAttachmentsForMessage({
  userId,
  messageId,
  scheduledAtts,
}: {
  userId: string;
  messageId: string;
  scheduledAtts: {
    filename: string;
    mimeType: string;
    buf: Buffer;
  }[];
}) {
  if (scheduledAtts.length === 0) return;

  const existing = await getDb()
    .select({ id: attachments.id })
    .from(attachments)
    .where(eq(attachments.messageId, messageId))
    .limit(1);
  if (existing.length > 0) return;

  for (const a of scheduledAtts) {
    const { storageKey, sizeBytes } = await saveAttachmentFile(
      userId,
      messageId,
      a.filename,
      a.buf,
      a.mimeType
    );
    await getDb().insert(attachments).values({
      messageId,
      filename: a.filename.slice(0, 512),
      mimeType: a.mimeType.slice(0, 255),
      sizeBytes,
      storageKey,
    });
  }
}

async function processJob(job: typeof scheduledEmails.$inferSelect) {
  const jobId = job.id;
  const providerMessageId = `scheduled-${jobId}`;
  logInfo("mail_scheduled_process_job_started", { jobId, userId: job.userId });
  const user = await loadUser(job.userId);
  if (!user) {
    logError("mail_scheduled_process_job_missing_user", { jobId, userId: job.userId });
    return;
  }

  // Mark as processing (best-effort to reduce duplicate picks).
  await getDb()
    .update(scheduledEmails)
    .set({ status: "processing" })
    .where(and(eq(scheduledEmails.id, jobId), eq(scheduledEmails.status, "scheduled")));

  const scheduledAttRows = await getDb()
    .select()
    .from(scheduledEmailAttachments)
    .where(eq(scheduledEmailAttachments.scheduledEmailId, jobId));

  const scheduledAtts = await Promise.all(
    scheduledAttRows.map(async (a) => {
      const keyType = classifyAttachmentStorageKey(a.storageKey);
      if (keyType !== "local") {
        throw new Error(`Scheduled attachment "${a.filename}" requires re-upload`);
      }
      const buf = await readOutboundAttachmentBuffer(a.storageKey, a.filename);
      logInfo("mail_scheduled_run_attachment_read_ok", {
        attachmentId: String(a.id),
        storageKey: a.storageKey,
        keyType,
        reader: "outbound-local-only",
        filename: a.filename.slice(0, 120),
        contentType: a.mimeType,
        sizeBytes: buf.length,
      });
      return {
        filename: a.filename,
        mimeType: a.mimeType,
        buf,
      };
    })
  );

  const hasAttachment = scheduledAtts.length > 0;

  const toList = splitRecipients(job.toAddr);
  const ccList = splitRecipients(job.ccAddr);
  const bccList = splitRecipients(job.bccAddr);

  // Partition internal vs external recipients.
  const internalUserIds = new Set<string>();
  const internalEmails = new Set<string>();
  const externalTo: string[] = [];
  const externalCc: string[] = [];
  const externalBcc: string[] = [];

  for (const email of toList) {
    const uid = await resolveInternalRecipientUserId(email);
    if (uid) {
      internalUserIds.add(uid);
      internalEmails.add(email);
    } else {
      externalTo.push(email);
    }
  }
  for (const email of ccList) {
    const uid = await resolveInternalRecipientUserId(email);
    if (uid) {
      internalUserIds.add(uid);
      internalEmails.add(email);
    } else {
      externalCc.push(email);
    }
  }
  for (const email of bccList) {
    const uid = await resolveInternalRecipientUserId(email);
    if (uid) {
      internalUserIds.add(uid);
      internalEmails.add(email);
    } else {
      externalBcc.push(email);
    }
  }

  const sendAnonymously = Boolean(job.sendAnonymously);
  const aliasLocalPart = sendAnonymously ? generateAnonymousAliasLocalPart() : null;
  const fromResolved = sendAnonymously && aliasLocalPart
    ? formatAnonymousOutboundFrom(aliasLocalPart)
    : await resolveSendFromForUser({
        user,
        mailboxId: job.mailboxId ?? null,
      });

  // Persist sender message for both internal and external paths.
  const senderMessageId = await ensureSenderMessage({
    user,
    providerMessageId,
    subject: job.subject,
    bodyText: job.bodyText,
    bodyHtml: job.bodyHtml,
    fromAddr: fromResolved.from,
    toAddr: job.toAddr,
    ccAddr: job.ccAddr,
    bccAddr: job.bccAddr,
    hasAttachment,
    sentAnonymously: sendAnonymously,
  });

  if (sendAnonymously && aliasLocalPart) {
    await getDb().insert(anonymousSendAliases).values({
      userId: user.id,
      aliasLocalPart,
      messageId: senderMessageId,
    });
  }

  // Save attachments for sender message.
  await saveAttachmentsForMessage({
    userId: user.id,
    messageId: senderMessageId,
    scheduledAtts,
  });

  const internalRecipientUserIdList = [...internalUserIds];
  const internalThreads = await Promise.all(
    internalRecipientUserIdList.map((uid) => resolveInboundThreadId(uid, null))
  );

  const internalRecipientIdsByThreadIndex = internalRecipientUserIdList.map(
    (uid) => uid
  );

  const internalMessageIds: string[] = [];
  // Ingest internal messages (bypass Resend).
  for (let i = 0; i < internalRecipientIdsByThreadIndex.length; i++) {
    const recipientUserId = internalRecipientIdsByThreadIndex[i]!;
    const recipientThreadId = internalThreads[i]!;
    const { id: inboundMessageId, created } = await ingestInboundMessage({
      providerMessageId: `${providerMessageId}-recv-${recipientUserId}`,
      userId: recipientUserId,
      subject: job.subject,
      bodyText: job.bodyText,
      bodyHtml: job.bodyHtml,
      fromAddr: fromResolved.from,
      toAddr: job.toAddr,
      ccAddr: job.ccAddr,
      threadId: recipientThreadId,
      hasAttachment,
      folder: "inbox",
    });
    internalMessageIds.push(inboundMessageId);

    if (created && scheduledAtts.length > 0) {
      await saveAttachmentsForMessage({
        userId: user.id,
        messageId: inboundMessageId,
        scheduledAtts,
      });
    }
  }

  const hasExternal =
    externalTo.length > 0 || externalCc.length > 0 || externalBcc.length > 0;

  if (hasExternal) {
    logInfo("mail_provider_call_pending", { jobId, userId: user.id });
    if (!isResendConfigured()) {
      throw new Error("Resend is not configured");
    }
    const { success } = await rateLimitSend(user.id);
    if (!success) {
      throw new Error("Send limit reached");
    }

    const externalInlineConversion = job.bodyHtml?.trim()
      ? convertInlineDataUrlsToCid(job.bodyHtml)
      : {
          html: "",
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

    const regularOutboundAttachments = scheduledAtts.map((a) =>
      serializeOutboundAttachment({
        filename: a.filename,
        content: a.buf,
        contentType: a.mimeType,
      })
    );
    const allOutboundAttachments = [
      ...regularOutboundAttachments,
      ...(externalInlineConversion.inlineAttachments ?? []),
    ];

    await sendOutboundMail({
      from: fromResolved.from,
      replyTo: fromResolved.replyTo,
      to: externalTo.length === 1 ? externalTo[0]! : externalTo,
      cc: externalCc.length ? externalCc : undefined,
      bcc: externalBcc.length ? externalBcc : undefined,
      subject: job.subject,
      text: job.bodyText.slice(0, 500_000),
      html: job.bodyHtml?.trim() ? externalHtmlCleaned : undefined,
      attachments: allOutboundAttachments.length
        ? allOutboundAttachments
        : undefined,
    });
    logInfo("mail_provider_call_success", { jobId, userId: user.id });
  } else {
    logInfo("mail_provider_call_skipped_internal_only", { jobId, userId: user.id });
  }

  await getDb()
    .update(scheduledEmails)
    .set({ status: "sent" })
    .where(eq(scheduledEmails.id, jobId));

  // If this job was created from the compose draft experience, clear the
  // draft row as well. Undo-cancel keeps the draft; successful send clears it.
  await getDb()
    .delete(composeAttachments)
    .where(eq(composeAttachments.userId, user.id));
  await getDb()
    .delete(composeDrafts)
    .where(eq(composeDrafts.userId, user.id));

  logInfo("mail_scheduled_sent", { jobId });
}

export async function POST(request: NextRequest) {
  logInfo("mail_scheduled_run_invoked");
  const token = request.headers.get("x-worker-token");
  if (
    process.env.SCHEDULED_EMAIL_WORKER_TOKEN &&
    token !== process.env.SCHEDULED_EMAIL_WORKER_TOKEN
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dueJobs = await getDb()
    .select()
    .from(scheduledEmails)
    .where(and(eq(scheduledEmails.status, "scheduled"), lte(scheduledEmails.sendAt, now)))
    .orderBy(scheduledEmails.sendAt)
    .limit(10);
  logInfo("mail_scheduled_run_due_jobs", { dueJobs: dueJobs.length });

  let remindersFired = 0;
  try {
    const dueReminders = await getDb()
      .select()
      .from(scheduledReminders)
      .where(
        and(
          eq(scheduledReminders.status, "pending"),
          lte(scheduledReminders.remindAt, now)
        )
      )
      .limit(50);
    for (const r of dueReminders) {
      try {
        await createUserNotification({
          userId: r.userId,
          type: "follow_up_reminder",
          title: "Scheduled reminder",
          body: r.note || "Follow-up",
          meta: { reminderId: r.id, messageId: r.messageId },
        });
        await getDb()
          .update(scheduledReminders)
          .set({ status: "completed" })
          .where(eq(scheduledReminders.id, r.id));
        remindersFired++;
      } catch (e) {
        logError("reminder_job_failed", {
          reminderId: r.id,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } catch (e) {
    logError("reminders_fetch_failed", {
      message: e instanceof Error ? e.message : String(e),
    });
  }

  if (dueJobs.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, remindersFired });
  }

  let processed = 0;
  for (const job of dueJobs) {
    try {
      await processJob(job);
      processed++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logError("mail_scheduled_job_failed", { jobId: job.id, message: msg });
    }
  }

  return NextResponse.json({ ok: true, processed, remindersFired });
}

