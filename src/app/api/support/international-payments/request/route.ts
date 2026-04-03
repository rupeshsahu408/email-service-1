import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";

import { sendOutboundMail } from "@/lib/resend-mail";
import { getEmailDomain } from "@/lib/constants";
import { getClientIp, rateLimitRecoverySupportByKey } from "@/lib/rate-limit";

const bodySchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  country: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  mobileNumber: z.string().trim().max(40).optional(),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
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

  const fullName = parsed.data.fullName;
  const country = parsed.data.country;
  const email = parsed.data.email;
  const mobileNumber = parsed.data.mobileNumber?.trim() || "(not provided)";

  // Lightweight dedupe/rate limiting to reduce accidental duplicate spam requests.
  const dedupeFingerprint = createHash("sha256")
    .update(`${ip}|${email.toLowerCase()}|international-payments`)
    .digest("hex")
    .slice(0, 32);

  const dedupe = await rateLimitRecoverySupportByKey(
    `international_payments:${dedupeFingerprint}`
  );
  if (!dedupe.success) {
    return NextResponse.json(
      { error: "Request already received recently. Please try again later." },
      { status: 429 }
    );
  }

  const to = "mail-support.studyhelp@gmail.com";
  const from = `Sendora <no-reply@${getEmailDomain()}>`;
  const subject = "[International Payments] Demand Request";
  const timestamp = new Date().toISOString();

  const text = [
    "International Payments demand request",
    "",
    `Full Name: ${fullName}`,
    `Country: ${country}`,
    `Email: ${email}`,
    `Mobile Number: ${mobileNumber}`,
    `Submission timestamp (UTC): ${timestamp}`,
  ].join("\n");

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;line-height:1.5">
      <h2 style="margin:0 0 10px 0;font-size:16px">International Payments demand request</h2>
      <p style="margin:0 0 6px 0"><strong>Full Name:</strong> ${fullName}</p>
      <p style="margin:0 0 6px 0"><strong>Country:</strong> ${country}</p>
      <p style="margin:0 0 6px 0"><strong>Email:</strong> ${email}</p>
      <p style="margin:0 0 6px 0"><strong>Mobile Number:</strong> ${mobileNumber}</p>
      <p style="margin:0 0 6px 0"><strong>Submission timestamp (UTC):</strong> ${timestamp}</p>
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

