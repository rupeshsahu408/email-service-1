import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/browser";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

import { getDb } from "@/db";
import { passkeyCredentials } from "@/db/schema";
import { getAuthContext } from "@/lib/session";
import {
  clearPasskeyChallengeCookie,
  ensurePasskeyTables,
  getExpectedOriginFromRequest,
  getRpIdFromRequest,
  readPasskeyChallengeFromRequest,
} from "@/lib/passkeys";

const bodySchema = z.object({
  response: z.custom<RegistrationResponseJSON>(),
});

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookie = readPasskeyChallengeFromRequest(request);
  if (!cookie || cookie.type !== "registration" || cookie.userId !== ctx.user.id) {
    return NextResponse.json(
      { error: "Passkey session expired. Please try again." },
      { status: 400 }
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

  await ensurePasskeyTables();

  const rpID = process.env.WEBAUTHN_RP_ID?.trim() || getRpIdFromRequest(request);
  const expectedOrigin = getExpectedOriginFromRequest(request);

  try {
    const verification = await verifyRegistrationResponse({
      response: parsed.data.response,
      expectedChallenge: cookie.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Could not verify passkey." }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;
    const credentialIdB64Url = credential.id;
    const publicKeyB64Url = isoBase64URL.fromBuffer(credential.publicKey);

    // Insert if new; if it already exists for this user, treat as ok.
    const existing = await getDb()
      .select({ id: passkeyCredentials.id })
      .from(passkeyCredentials)
      .where(
        and(
          eq(passkeyCredentials.userId, ctx.user.id),
          eq(passkeyCredentials.credentialId, credentialIdB64Url)
        )
      )
      .limit(1);
    if (existing.length === 0) {
      await getDb().insert(passkeyCredentials).values({
        userId: ctx.user.id,
        credentialId: credentialIdB64Url,
        publicKey: publicKeyB64Url,
        counter: credential.counter,
        transports:
          (parsed.data.response.response.transports as string[] | undefined) ?? null,
        updatedAt: new Date(),
      });
    }

    await clearPasskeyChallengeCookie();
    return NextResponse.json({ ok: true });
  } catch {
    await clearPasskeyChallengeCookie();
    return NextResponse.json(
      { error: "Passkey verification failed. Please try again." },
      { status: 400 }
    );
  }
}

