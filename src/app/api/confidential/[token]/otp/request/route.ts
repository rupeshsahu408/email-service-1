import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomInt } from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { confidentialMessages, confidentialOtps } from "@/db/schema";
import { sendOutboundMail } from "@/lib/resend-mail";
import { getEmailDomain } from "@/lib/constants";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
});

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const tokenHash = sha256Hex(token);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const msgRows = await getDb()
    .select()
    .from(confidentialMessages)
    .where(eq(confidentialMessages.tokenHash, tokenHash))
    .limit(1);
  const msg = msgRows[0];
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (new Date(msg.expiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }
  if (msg.passcodeMode !== "email_otp") {
    return NextResponse.json({ error: "Passcode mode not supported" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();

  // Basic throttle: reuse the latest unexpired OTP if it exists.
  const recent = await getDb()
    .select()
    .from(confidentialOtps)
    .where(
      and(
        eq(confidentialOtps.messageId, msg.id),
        eq(confidentialOtps.email, email),
        isNull(confidentialOtps.usedAt)
      )
    )
    .orderBy(desc(confidentialOtps.createdAt))
    .limit(1);
  const existing = recent[0];
  if (existing && new Date(existing.expiresAt).getTime() > Date.now()) {
    return NextResponse.json({ ok: true });
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const secret = process.env.CONFIDENTIAL_OTP_SECRET?.trim() || tokenHash;
  const codeHash = sha256Hex(`${secret}:${msg.id}:${email}:${code}`);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await getDb().insert(confidentialOtps).values({
    messageId: msg.id,
    email,
    codeHash,
    expiresAt,
  });

  // Send OTP email (best-effort).
  const from = `Sendora <no-reply@${getEmailDomain()}>`;
  const subject = "Your Sendora confidential code";
  const text = `Your code is: ${code}\n\nIt expires in 10 minutes.`;
  const html = `<p>Your code is:</p><p style="font-size:20px;font-weight:700;letter-spacing:0.08em">${code}</p><p style="color:rgba(0,0,0,0.6)">Expires in 10 minutes.</p>`;

  try {
    await sendOutboundMail({ from, to: email, subject, text, html });
  } catch {
    // Don't leak provider errors to the client.
    return NextResponse.json({ error: "Could not send code" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

