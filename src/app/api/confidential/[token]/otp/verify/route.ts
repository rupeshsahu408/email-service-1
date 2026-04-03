import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { confidentialMessages, confidentialOtps } from "@/db/schema";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(12),
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
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
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
  const code = parsed.data.code.trim();
  const secret = process.env.CONFIDENTIAL_OTP_SECRET?.trim() || tokenHash;
  const expectedHash = sha256Hex(`${secret}:${msg.id}:${email}:${code}`);

  const otpRows = await getDb()
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
  const otp = otpRows[0];
  if (!otp) return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  if (new Date(otp.expiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Code expired" }, { status: 400 });
  }
  if (otp.codeHash !== expectedHash) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  await getDb()
    .update(confidentialOtps)
    .set({ usedAt: new Date() })
    .where(eq(confidentialOtps.id, otp.id));

  return NextResponse.json({
    ok: true,
    html: msg.bodyHtml,
    text: msg.bodyText,
    subject: msg.subject,
  });
}

