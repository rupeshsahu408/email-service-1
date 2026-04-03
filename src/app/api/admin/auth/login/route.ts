import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { verifySecret } from "@/lib/password";
import { getClientIp } from "@/lib/rate-limit";
import {
  attachAdminSessionCookie,
  ensureSessionSchema,
  issueSession,
} from "@/lib/session";
import { adminLoginBodySchema } from "@/lib/validation";
import { recordAuthLoginEvent } from "@/lib/auth-login-audit";
import { fetchSecurityLockIfExists } from "@/lib/auth-login-schema-compat";
import { isSecurityLocked } from "@/lib/auth-security-lock";

function invalidCredentials() {
  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  await ensureSessionSchema();
  const ua = request.headers.get("user-agent") ?? undefined;
  const ipHint = getClientIp(request.headers);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = adminLoginBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }

  const normalizedEmail = parsed.data.email.toLowerCase().trim();
  const [localPart, domain] = normalizedEmail.split("@");
  if (!localPart || domain !== "sendora.com") {
    await recordAuthLoginEvent({
      outcome: "failed",
      authMethod: "admin_password",
      context: "admin_panel",
      identifier: normalizedEmail,
      failureCode: "invalid_email_domain",
      headers: request.headers,
    });
    return invalidCredentials();
  }

  const rows = await getDb()
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      isAdmin: users.isAdmin,
      isSuspended: users.isSuspended,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.localPart, localPart))
    .limit(1);

  if (rows.length === 0) {
    await recordAuthLoginEvent({
      outcome: "failed",
      authMethod: "admin_password",
      context: "admin_panel",
      identifier: normalizedEmail,
      failureCode: "user_not_found",
      headers: request.headers,
    });
    return invalidCredentials();
  }
  const user = rows[0];
  const lock = await fetchSecurityLockIfExists(user.id);
  const userWithLock = { ...user, securityLockedUntil: lock.securityLockedUntil };

  if (!user.isAdmin) {
    await recordAuthLoginEvent({
      outcome: "failed",
      authMethod: "admin_password",
      context: "admin_panel",
      userId: user.id,
      identifier: normalizedEmail,
      failureCode: "not_admin",
      headers: request.headers,
    });
    return invalidCredentials();
  }
  if (user.deletedAt || user.isSuspended) {
    await recordAuthLoginEvent({
      outcome: "failed",
      authMethod: "admin_password",
      context: "admin_panel",
      userId: user.id,
      identifier: normalizedEmail,
      failureCode: "account_unavailable",
      headers: request.headers,
    });
    return NextResponse.json(
      { error: "This account is not available." },
      { status: 403 }
    );
  }
  if (isSecurityLocked(userWithLock)) {
    await recordAuthLoginEvent({
      outcome: "failed",
      authMethod: "admin_password",
      context: "admin_panel",
      userId: user.id,
      identifier: normalizedEmail,
      failureCode: "security_locked",
      headers: request.headers,
    });
    return NextResponse.json(
      { error: "Sign-in is temporarily blocked for this account." },
      { status: 403 }
    );
  }

  const ok = await verifySecret(user.passwordHash, parsed.data.password);
  if (!ok) {
    await recordAuthLoginEvent({
      outcome: "failed",
      authMethod: "admin_password",
      context: "admin_panel",
      userId: user.id,
      identifier: normalizedEmail,
      failureCode: "bad_password",
      headers: request.headers,
    });
    return invalidCredentials();
  }

  await recordAuthLoginEvent({
    outcome: "success",
    authMethod: "admin_password",
    context: "admin_panel",
    userId: user.id,
    identifier: normalizedEmail,
    headers: request.headers,
  });

  const issued = await issueSession(user.id, { userAgent: ua, ipHint });
  await getDb()
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  const res = NextResponse.json({ ok: true });
  attachAdminSessionCookie(res, issued.token, issued.expiresAt);
  return res;
}
