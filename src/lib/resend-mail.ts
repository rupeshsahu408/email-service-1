import type { AttachmentData, WebhookEventPayload } from "resend";
import { Resend } from "resend";
import { logError, logInfo } from "./logger";

let resendSingleton: Resend | null = null;
let loggedDevKeyHint = false;

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Throws if `RESEND_API_KEY` is missing. */
export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error("RESEND_API_KEY is not set");
  }
  if (!resendSingleton) {
    resendSingleton = new Resend(key);
    if (process.env.NODE_ENV === "development" && !loggedDevKeyHint) {
      loggedDevKeyHint = true;
      logInfo("resend_client_init", {
        keyPrefix: `${key.slice(0, 6)}…`,
        keyLength: key.length,
      });
    }
  }
  return resendSingleton;
}

export type OutboundAttachment = {
  filename: string;
  content: Buffer<ArrayBufferLike>;
  contentType?: string;
  /**
   * Optional content ID for inline attachments.
   * If set, Resend sends the attachment inline and the HTML can reference it via `cid:${contentId}`.
   */
  contentId?: string;
};

export function serializeOutboundAttachment(input: {
  filename: string;
  content: Buffer<ArrayBufferLike>;
  contentType?: string | null;
  contentId?: string | null;
}): OutboundAttachment {
  return {
    filename: input.filename.slice(0, 512),
    content: input.content,
    contentType: input.contentType?.slice(0, 255) || undefined,
    contentId: input.contentId ?? undefined,
  };
}

export async function sendOutboundMail(params: {
  from: string;
  replyTo?: string;
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: OutboundAttachment[];
}): Promise<{ id: string }> {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: params.from,
    replyTo: params.replyTo ?? undefined,
    to: params.to,
    cc: params.cc?.length ? params.cc : undefined,
    bcc: params.bcc?.length ? params.bcc : undefined,
    subject: params.subject,
    text: params.text,
    html: params.html,
    attachments:
      params.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
        contentId: a.contentId,
      })) ?? undefined,
  });
  if (error) {
    logError("resend_emails_send_rejected", {
      code: error.name,
      message: error.message,
      status: error.statusCode ?? 0,
    });
    const err = new Error(error.message) as Error & { resendCode?: string };
    err.resendCode = error.name;
    throw err;
  }
  if (!data?.id) {
    logError("resend_send_no_id", { message: "Resend returned success but no id" });
    throw new Error("Resend did not return an email id");
  }
  return { id: data.id };
}

export function verifyResendWebhook(
  payload: string,
  svixHeaders: { id: string; timestamp: string; signature: string }
): WebhookEventPayload {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    logError("resend_webhook_secret_missing");
    throw new Error("RESEND_WEBHOOK_SECRET is not set");
  }
  return getResend().webhooks.verify({
    payload,
    webhookSecret: secret,
    headers: svixHeaders,
  });
}

export async function fetchReceivedEmail(emailId: string) {
  const { data, error } = await getResend().emails.receiving.get(emailId);
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("No received email");
  }
  return data;
}

export async function listReceivingAttachments(
  emailId: string
): Promise<AttachmentData[]> {
  const { data, error } =
    await getResend().emails.receiving.attachments.list({ emailId });
  if (error) {
    throw new Error(error.message);
  }
  return data?.data ?? [];
}

export async function downloadFromSignedUrl(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Attachment download failed: HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
