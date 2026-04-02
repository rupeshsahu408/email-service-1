import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { sendOutboundMail } from "@/lib/resend-mail";
import { getEmailDomain, formatUserEmail } from "@/lib/constants";
import {
  getClientIp,
  rateLimitRecoverySupport,
  rateLimitRecoverySupportByKey,
} from "@/lib/rate-limit";

const bodySchema = z.object({
  username: z.string().max(64).optional().default(""),
  source: z.string().max(64).optional().default("forgot_password"),
  hasBackupFile: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const { success } = await rateLimitRecoverySupport(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const username = parsed.data.username.trim().toLowerCase();
  const identifier = username ? formatUserEmail(username) : "(not provided)";
  const source = parsed.data.source.trim() || "forgot_password";
  const hasBackupFile = parsed.data.hasBackupFile ? "yes" : "no";
  const userAgent = request.headers.get("user-agent") ?? "(unknown)";
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "(missing)";
  const referer = request.headers.get("referer") ?? "(missing)";
  const reqId = request.headers.get("x-vercel-id") ?? request.headers.get("x-request-id") ?? "(missing)";

  // Cooldown per identifier+IP to reduce accidental duplicate spam requests.
  const dedupeFingerprint = createHash("sha256")
    .update(`${ip}|${username || "unknown"}`)
    .digest("hex")
    .slice(0, 32);
  const dedupe = await rateLimitRecoverySupportByKey(`dedupe:${dedupeFingerprint}`);
  if (!dedupe.success) {
    return NextResponse.json(
      { error: "Support request already sent recently. Please wait a few minutes." },
      { status: 429 }
    );
  }

  const to = "support.studyhelp@gmail.com";
  const from = `Sendora <no-reply@${getEmailDomain()}>`;
  const subject = "[Password Recovery] No-backup support request";
  const timestamp = new Date().toISOString();
  const text = [
    "Password recovery support request (no backup file).",
    "",
    `User identifier: ${identifier}`,
    "Request type: password recovery without backup",
    `Source: ${source}`,
    `User reports backup available: ${hasBackupFile}`,
    `Request id: ${reqId}`,
    `IP hint: ${ip}`,
    `Forwarded-for: ${forwardedFor}`,
    `Referer: ${referer}`,
    `User-Agent: ${userAgent}`,
    `Timestamp (UTC): ${timestamp}`,
  ].join("\n");
  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.5">
      <h2 style="margin:0 0 8px 0;font-size:16px">Password recovery support request</h2>
      <p style="margin:0 0 4px 0"><strong>User identifier:</strong> ${identifier}</p>
      <p style="margin:0 0 4px 0"><strong>Request type:</strong> password recovery without backup</p>
      <p style="margin:0 0 4px 0"><strong>Source:</strong> ${source}</p>
      <p style="margin:0 0 4px 0"><strong>User reports backup available:</strong> ${hasBackupFile}</p>
      <p style="margin:0 0 4px 0"><strong>Request id:</strong> ${reqId}</p>
      <p style="margin:0 0 4px 0"><strong>IP hint:</strong> ${ip}</p>
      <p style="margin:0 0 4px 0"><strong>Forwarded-for:</strong> ${forwardedFor}</p>
      <p style="margin:0 0 4px 0"><strong>Referer:</strong> ${referer}</p>
      <p style="margin:0 0 4px 0"><strong>User-Agent:</strong> ${userAgent}</p>
      <p style="margin:0 0 4px 0"><strong>Timestamp (UTC):</strong> ${timestamp}</p>
    </div>
  `.trim();

  try {
    await sendOutboundMail({ from, to, subject, text, html });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not send support request" },
      { status: 502 }
    );
  }
}

