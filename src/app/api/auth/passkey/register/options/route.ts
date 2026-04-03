import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { generateRegistrationOptions } from "@simplewebauthn/server";

import { getDb } from "@/db";
import { passkeyCredentials } from "@/db/schema";
import { getAuthContext } from "@/lib/session";
import {
  ensurePasskeyTables,
  getExpectedOriginFromRequest,
  getRpIdFromRequest,
  setPasskeyChallengeCookie,
} from "@/lib/passkeys";

const bodySchema = z.object({
  // Optional friendly name in future; kept for forward compatibility.
  label: z.string().max(64).optional(),
});

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await ensurePasskeyTables();

  const rpID = process.env.WEBAUTHN_RP_ID?.trim() || getRpIdFromRequest(request);
  const rpName = "Sendora";

  const existing = await getDb()
    .select({
      credentialId: passkeyCredentials.credentialId,
    })
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.userId, ctx.user.id));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(ctx.user.id),
    userName: ctx.user.localPart,
    timeout: 60_000,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: ["internal"],
    })),
  });

  await setPasskeyChallengeCookie({
    type: "registration",
    challenge: options.challenge,
    userId: ctx.user.id,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  // expectedOrigin is used only during verify; sending it isn't necessary,
  // but we compute here to ensure request headers are sane.
  getExpectedOriginFromRequest(request);

  return NextResponse.json({ ok: true, options });
}

