import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { authLoginEvents, users } from "@/db/schema";
import { logError, logInfo } from "@/lib/logger";
import { verifySecret } from "@/lib/password";
import { getClientIp } from "@/lib/rate-limit";
import {
  attachAccountBundleCookie,
  attachSessionCookie,
  ensureSessionSchema,
  getOrCreateAccountBundleId,
  issueSession,
  linkAccountToBundle,
} from "@/lib/session";
import { loginBodySchema } from "@/lib/validation";
import { recordAdminActivity } from "@/lib/admin-activity";
import { recordAuthLoginEvent } from "@/lib/auth-login-audit";
import { fetchSecurityLockIfExists } from "@/lib/auth-login-schema-compat";
import { isSecurityLocked } from "@/lib/auth-security-lock";
import { getAdminSystemSettings } from "@/lib/admin-system-settings";

export async function POST(request: NextRequest) {
  try {
    const settings = await getAdminSystemSettings();
    await ensureSessionSchema();
    const ua = request.headers.get("user-agent") ?? undefined;
    const ipHint = getClientIp(request.headers);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = loginBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 400 }
      );
    }

    const rawIdentifier = parsed.data.identifier.trim().toLowerCase();
    const username = rawIdentifier.includes("@")
      ? (rawIdentifier.split("@")[0] ?? "")
      : rawIdentifier;
    if (!username) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
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
      .where(eq(users.localPart, username))
      .limit(1);

    if (rows.length === 0) {
      await recordAuthLoginEvent({
        outcome: "failed",
        authMethod: "password",
        context: "app",
        identifier: rawIdentifier,
        failureCode: "user_not_found",
        headers: request.headers,
      });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const user = rows[0];
    if (settings.maintenance.enabled && !user.isAdmin) {
      return NextResponse.json(
        { error: settings.maintenance.message },
        { status: 503 }
      );
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const failedRows = await getDb()
      .select({ c: count() })
      .from(authLoginEvents)
      .where(
        and(
          eq(authLoginEvents.userId, user.id),
          eq(authLoginEvents.outcome, "failed"),
          gte(authLoginEvents.createdAt, since)
        )
      );
    const failedCount = Number(failedRows[0]?.c ?? 0);
    const attemptLimit = Number(settings.security.maxLoginAttempts ?? 0);
    if (attemptLimit > 0 && failedCount >= attemptLimit) {
      return NextResponse.json(
        { error: "Too many failed attempts. Try again later or reset your password." },
        { status: 429 }
      );
    }
    const lock = await fetchSecurityLockIfExists(user.id);
    const userWithLock = { ...user, securityLockedUntil: lock.securityLockedUntil };

    if (user.deletedAt || user.isSuspended) {
      await recordAuthLoginEvent({
        outcome: "failed",
        authMethod: "password",
        context: "app",
        userId: user.id,
        identifier: rawIdentifier,
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
        authMethod: "password",
        context: "app",
        userId: user.id,
        identifier: rawIdentifier,
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
        authMethod: "password",
        context: "app",
        userId: user.id,
        identifier: rawIdentifier,
        failureCode: "bad_password",
        headers: request.headers,
      });
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    await recordAuthLoginEvent({
      outcome: "success",
      authMethod: "password",
      context: "app",
      userId: user.id,
      identifier: rawIdentifier,
      headers: request.headers,
    });

    const issued = await issueSession(user.id, { userAgent: ua, ipHint });
    const bundleId = await getOrCreateAccountBundleId();
    await linkAccountToBundle(bundleId, user.id);
    await getDb()
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
    if (user.isAdmin) {
      await recordAdminActivity({
        eventType: "admin_login",
        severity: "success",
        actorUserId: user.id,
        detail: "Admin login successful.",
        meta: { ipHint },
      });
    }
    logInfo("user_login", { userId: user.id });

    const res = NextResponse.json({
      ok: true,
      redirectTo: user.isAdmin ? "/admin/dashboard" : "/inbox",
    });
    attachSessionCookie(res, issued.token, issued.expiresAt);
    attachAccountBundleCookie(res, bundleId);
    return res;
  } catch (e) {
    logError("login_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json(
      {
        error:
          "Could not complete sign-in. If you recently updated the app, run database migrations (npm run db:migrate) and try again.",
      },
      { status: 500 }
    );
  }
}
