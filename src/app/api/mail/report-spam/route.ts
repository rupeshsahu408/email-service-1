import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { sendOutboundMail } from "@/lib/resend-mail";
import { hasMessageAuthColumns } from "@/lib/message-auth-columns";
import { getCurrentUser } from "@/lib/session";
import { getEmailDomain, formatUserEmail } from "@/lib/constants";

const bodySchema = z.object({
  messageId: z.string().min(1),
  from: z.string().min(3).max(320),
  subject: z.string().max(998).optional().default(""),
  snippet: z.string().max(1000).optional().default(""),
});

export async function POST(request: NextRequest) {
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const data = parsed.data;
  const reporter = formatUserEmail(user.localPart);
  const canReadAuthCols = await hasMessageAuthColumns();
  const messageRow = canReadAuthCols
    ? await getDb()
        .select({
          id: messages.id,
          providerMessageId: messages.providerMessageId,
          fromAddr: messages.fromAddr,
          toAddr: messages.toAddr,
          ccAddr: messages.ccAddr,
          folder: messages.folder,
          threadId: messages.threadId,
          createdAt: messages.createdAt,
          subject: messages.subject,
          mailedBy: messages.mailedBy,
          signedBy: messages.signedBy,
        })
        .from(messages)
        .where(and(eq(messages.id, data.messageId), eq(messages.userId, user.id)))
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : await getDb()
        .select({
          id: messages.id,
          providerMessageId: messages.providerMessageId,
          fromAddr: messages.fromAddr,
          toAddr: messages.toAddr,
          ccAddr: messages.ccAddr,
          folder: messages.folder,
          threadId: messages.threadId,
          createdAt: messages.createdAt,
          subject: messages.subject,
        })
        .from(messages)
        .where(and(eq(messages.id, data.messageId), eq(messages.userId, user.id)))
        .limit(1)
        .then((rows) =>
          rows[0]
            ? {
                ...rows[0],
                mailedBy: null,
                signedBy: null,
              }
            : null
        );
  const to = "support.studyhelp@gmail.com";
  const from = `Sendora <no-reply@${getEmailDomain()}>`;
  const effectiveSender = messageRow?.fromAddr ?? data.from;
  const effectiveSubject = messageRow?.subject || data.subject || "(no subject)";
  const reportSubject = `[Spam Report] ${effectiveSubject}`;
  const text = [
    "Spam report submitted from Sendora.",
    "",
    `Reporter: ${reporter}`,
    `Sender: ${effectiveSender}`,
    `Message ID: ${data.messageId}`,
    `Provider Message ID: ${messageRow?.providerMessageId ?? "(unavailable)"}`,
    `Thread ID: ${messageRow?.threadId ?? "(unavailable)"}`,
    `Subject: ${effectiveSubject}`,
    `Reported At (UTC): ${new Date().toISOString()}`,
    `Message Date (UTC): ${messageRow?.createdAt?.toISOString() ?? "(unavailable)"}`,
    `Mailbox Folder: ${messageRow?.folder ?? "(unavailable)"}`,
    `To: ${messageRow?.toAddr ?? "(unavailable)"}`,
    `Cc: ${messageRow?.ccAddr || "(none)"}`,
    `Mailed-By: ${messageRow?.mailedBy ?? "(unavailable)"}`,
    `Signed-By: ${messageRow?.signedBy ?? "(unavailable)"}`,
    "",
    "Snippet:",
    data.snippet || "(empty)",
  ].join("\n");
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.5">
      <h2 style="margin:0 0 8px 0;font-size:16px">Spam report submitted</h2>
      <p style="margin:0 0 4px 0"><strong>Reporter:</strong> ${reporter}</p>
      <p style="margin:0 0 4px 0"><strong>Sender:</strong> ${effectiveSender}</p>
      <p style="margin:0 0 4px 0"><strong>Message ID:</strong> ${data.messageId}</p>
      <p style="margin:0 0 4px 0"><strong>Provider Message ID:</strong> ${messageRow?.providerMessageId ?? "(unavailable)"}</p>
      <p style="margin:0 0 4px 0"><strong>Thread ID:</strong> ${messageRow?.threadId ?? "(unavailable)"}</p>
      <p style="margin:0 0 4px 0"><strong>Subject:</strong> ${effectiveSubject}</p>
      <p style="margin:0 0 4px 0"><strong>Reported At (UTC):</strong> ${new Date().toISOString()}</p>
      <p style="margin:0 0 4px 0"><strong>Message Date (UTC):</strong> ${messageRow?.createdAt?.toISOString() ?? "(unavailable)"}</p>
      <p style="margin:0 0 4px 0"><strong>Mailbox Folder:</strong> ${messageRow?.folder ?? "(unavailable)"}</p>
      <p style="margin:0 0 4px 0"><strong>To:</strong> ${messageRow?.toAddr ?? "(unavailable)"}</p>
      <p style="margin:0 0 4px 0"><strong>Cc:</strong> ${messageRow?.ccAddr || "(none)"}</p>
      <p style="margin:0 0 4px 0"><strong>Mailed-By:</strong> ${messageRow?.mailedBy ?? "(unavailable)"}</p>
      <p style="margin:0 0 10px 0"><strong>Signed-By:</strong> ${messageRow?.signedBy ?? "(unavailable)"}</p>
      <p style="margin:0 0 6px 0"><strong>Snippet:</strong></p>
      <pre style="white-space:pre-wrap;background:#f7f7fb;padding:10px;border-radius:8px;margin:0">${data.snippet || "(empty)"}</pre>
    </div>
  `.trim();

  try {
    await sendOutboundMail({
      from,
      to,
      subject: reportSubject,
      text,
      html,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not submit report" }, { status: 502 });
  }
}

