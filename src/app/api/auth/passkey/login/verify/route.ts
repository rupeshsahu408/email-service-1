import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/browser";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

import { getDb } from "@/db";
import { passkeyCredentials, users } from "@/db/schema";
import { getClientIp } from "@/lib/rate-limit";
import {
  attachAccountBundleCookie,
  attachSessionCookie,
  ensureSessionSchema,
  getOrCreateAccountBundleId,
  issueSession,
  linkAccountToBundle,
} from "@/lib/session";
import {
  clearPasskeyChallengeCookie,
  ensurePasskeyTables,
  getExpectedOriginFromRequest,
  getRpIdFromRequest,
  readPasskeyChallengeFromRequest,
} from "@/lib/passkeys";
import { recordAuthLoginEvent } from "@/lib/auth-login-audit";
import { fetchSecurityLockIfExists } from "@/lib/auth-login-schema-compat";
import { isSecurityLocked } from "@/lib/auth-security-lock";

const bodySchema = z.object({
  response: z.custom<AuthenticationResponseJSON>(),
});

export async function POST(request: NextRequest) {
  await ensureSessionSchema();
  const cookie = readPasskeyChallengeFromRequest(request);
  if (!cookie || cookie.type !== "authentication") {
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

  const credentialId = parsed.data.response.id;
  const row = await getDb()
    .select({
      cred: passkeyCredentials,
      user: {
        id: users.id,
        localPart: users.localPart,
        isAdmin: users.isAdmin,
        isSuspended: users.isSuspended,
        deletedAt: users.deletedAt,
      },
    })
    .from(passkeyCredentials)
    .innerJoin(users, eq(passkeyCredentials.userId, users.id))
    .where(eq(passkeyCredentials.credentialId, credentialId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) {
    await clearPasskeyChallengeCookie();
    await recordAuthLoginEvent({
      outcome: "failed",
      authMethod: "passkey",
      context: "app",
      identifier: credentialId.slice(0, 320),
      failureCode: "credential_not_found",
      headers: request.headers,
    });
    return NextResponse.json({ error: "Could not verify passkey." }, { status: 400 });
  }

  const identifier = `${row.user.localPart}@sendora.com`;
  const lock = await fetchSecurityLockIfExists(row.user.id);
  const userWithLock = {
    ...row.user,
    securityLockedUntil: lock.securityLockedUntil,
  };

  if (row.user.deletedAt || row.user.isSuspended) {
    await clearPasskeyChallengeCookie();
    await recordAuthLoginEvent({
      outcome: "failed",
      authMethod: "passkey",
      context: "app",
      userId: row.user.id,
      identifier,
      failureCode: "account_unavailable",
      headers: request.headers,
    });
    return NextResponse.json(
      { error: "This account is not available." },
      { status: 403 }
    );
  }

  if (isSecurityLocked(userWithLock)) {
    await clearPasskeyChallengeCookie();
    await recordAuthLoginEvent({
      outcome: "failed",
      authMethod: "passkey",
      context: "app",
      userId: row.user.id,
      identifier,
      failureCode: "security_locked",
      headers: request.headers,
    });
    return NextResponse.json(
      { error: "Sign-in is temporarily blocked for this account." },
      { status: 403 }
    );
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: parsed.data.response,
      expectedChallenge: cookie.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: row.cred.credentialId,
        publicKey: isoBase64URL.toBuffer(row.cred.publicKey),
        counter: row.cred.counter ?? 0,
      },
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.authenticationInfo) {
      await clearPasskeyChallengeCookie();
      await recordAuthLoginEvent({
        outcome: "failed",
        authMethod: "passkey",
        context: "app",
        userId: row.user.id,
        identifier,
        failureCode: "passkey_verify_failed",
        headers: request.headers,
      });
      return NextResponse.json({ error: "Could not verify passkey." }, { status: 400 });
    }

    await getDb()
      .update(passkeyCredentials)
      .set({ counter: verification.authenticationInfo.newCounter, updatedAt: new Date() })
      .where(eq(passkeyCredentials.id, row.cred.id));

    const ua = request.headers.get("user-agent") ?? undefined;
    const ipHint = getClientIp(request.headers);
    const issued = await issueSession(row.user.id, { userAgent: ua, ipHint });
    const bundleId = await getOrCreateAccountBundleId();
    await linkAccountToBundle(bundleId, row.user.id);
    await getDb()
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, row.user.id));

    await clearPasskeyChallengeCookie();

    await recordAuthLoginEvent({
      outcome: "success",
      authMethod: "passkey",
      context: "app",
      userId: row.user.id,
      identifier,
      headers: request.headers,
    });

    const res = NextResponse.json({
      ok: true,
      redirectTo: row.user.isAdmin ? "/admin/dashboard" : "/inbox",
    });
    attachSessionCookie(res, issued.token, issued.expiresAt);
    attachAccountBundleCookie(res, bundleId);
    return res;
  } catch {
    await clearPasskeyChallengeCookie();
    await recordAuthLoginEvent({
      outcome: "failed",
      authMethod: "passkey",
      context: "app",
      userId: row.user.id,
      identifier,
      failureCode: "passkey_verify_failed",
      headers: request.headers,
    });
    return NextResponse.json(
      { error: "Passkey verification failed. Please try again." },
      { status: 400 }
    );
  }
}

