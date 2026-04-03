import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";

import { sendOutboundMail } from "@/lib/resend-mail";
import { getEmailDomain, getProfessionalRootDomain } from "@/lib/constants";
import { getAdminSystemSettings } from "@/lib/admin-system-settings";
import { getClientIp, rateLimitRecoverySupportByKey } from "@/lib/rate-limit";
import { SUPPORT_INTERNATIONAL_PAYMENTS_EMAIL } from "@/lib/support-international-payments-email";

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

  const to = SUPPORT_INTERNATIONAL_PAYMENTS_EMAIL;
  const adminSettings = await getAdminSystemSettings();
  const fromPrimary = `${adminSettings.general.appName} <${
    adminSettings.email.defaultSenderEmail || `no-reply@${getEmailDomain()}`
  }>`;
  const fromFallback = `${adminSettings.general.appName} <no-reply@${getProfessionalRootDomain()}>`;
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

  async function sendWithFrom(from: string) {
    const result = await sendOutboundMail({ from, to, subject, text, html });
    return result;
  }

  try {
    const result = await sendWithFrom(fromPrimary);
    console.info("international-payments/request: sent", {
      to,
      from: fromPrimary,
      subject,
      resendEmailId: result.id,
    });
    return NextResponse.json({ ok: true, to: SUPPORT_INTERNATIONAL_PAYMENTS_EMAIL });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    // Resend validates the `from` domain. If `sendora.com` isn't verified, retry with `sendora.me`.
    if (/domain is not verified/i.test(msg) || msg.includes("Please, add and verify your domain")) {
      console.error("international-payments/request: primary from domain unverified, retrying", {
        fromPrimary,
        fromFallback,
        message: msg,
      });
      try {
        const result = await sendWithFrom(fromFallback);
        console.info("international-payments/request: sent (fallback from)", {
          to,
          from: fromFallback,
          subject,
          resendEmailId: result.id,
        });
        return NextResponse.json({ ok: true, to: SUPPORT_INTERNATIONAL_PAYMENTS_EMAIL });
      } catch (e2) {
        const msg2 = e2 instanceof Error ? e2.message : String(e2);
        console.error("international-payments/request: fallback send failed", {
          message: msg2,
        });
        return NextResponse.json({ error: msg2 }, { status: 502 });
      }
    }

    console.error("international-payments/request: send failed", { message: msg });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

