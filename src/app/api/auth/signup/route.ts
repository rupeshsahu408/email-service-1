import { NextRequest, NextResponse, after } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { formatUserEmail } from "@/lib/constants";
import { logError, logInfo } from "@/lib/logger";
import { hashSecret } from "@/lib/password";
import { rateLimitSignup, getClientIp } from "@/lib/rate-limit";
import {
  attachSessionCookie,
  issueSession,
} from "@/lib/session";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { signupBodySchema } from "@/lib/validation";
import { recordAdminActivity } from "@/lib/admin-activity";
import { getAdminSystemSettings } from "@/lib/admin-system-settings";
import { sendWelcomeEmail, welcomeDisplayName } from "@/lib/transactional-email";

function readErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}

export async function POST(request: NextRequest) {
  const settings = await getAdminSystemSettings();
  if (!settings.features.signupEnabled) {
    return NextResponse.json(
      { error: "New signups are currently disabled." },
      { status: 503 }
    );
  }
  if (settings.maintenance.enabled) {
    return NextResponse.json({ error: settings.maintenance.message }, { status: 503 });
  }

  const ip = getClientIp(request.headers);
  const { success } = await rateLimitSignup(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many signups from this network. Try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = signupBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  if (parsed.data.password.length < settings.security.minPasswordLength) {
    return NextResponse.json(
      { error: `Password must be at least ${settings.security.minPasswordLength} characters.` },
      { status: 400 }
    );
  }

  const username = parsed.data.username.toLowerCase();
  const turnstileOk = await verifyTurnstileToken(parsed.data.turnstileToken);
  if (!turnstileOk) {
    return NextResponse.json(
      { error: "Verification failed. Refresh and try again." },
      { status: 400 }
    );
  }

  const passwordHash = await hashSecret(parsed.data.password);
  const recoveryKey = randomBytes(32).toString("hex");
  const recoveryKeyHash = await hashSecret(recoveryKey);

  const taken = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.localPart, username))
    .limit(1);
  if (taken.length > 0) {
    return NextResponse.json(
      { error: "That address is already taken." },
      { status: 409 }
    );
  }

  let userId: string;
  try {
    const inserted = await getDb()
      .insert(users)
      .values({
        localPart: username,
        passwordHash,
        recoveryKeyHash,
        storageQuotaBytes:
          settings.storage.perUserStorageLimitBytes > 0
            ? settings.storage.perUserStorageLimitBytes
            : undefined,
      })
      .returning({ id: users.id });
    if (inserted.length === 0) {
      return NextResponse.json(
        { error: "Could not create account." },
        { status: 500 }
      );
    }
    userId = inserted[0].id;
  } catch (e) {
    const code = readErrorCode(e);
    if (code === "23505") {
      return NextResponse.json(
        { error: "That address is already taken." },
        { status: 409 }
      );
    }
    logError("signup_insert_failed", {
      message: e instanceof Error ? e.message : "unknown",
      code,
    });
    return NextResponse.json(
      { error: "Could not create account." },
      { status: 500 }
    );
  }

  const ua = request.headers.get("user-agent") ?? undefined;
  const issued = await issueSession(userId, { userAgent: ua, ipHint: ip });
  await getDb()
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId));
  logInfo("user_signup", { userId });
  await recordAdminActivity({
    eventType: "user_created",
    severity: "info",
    subjectUserId: userId,
    detail: "New user account created.",
    meta: { username },
  });

  // Defer to `after()` so signup responds quickly but serverless still runs the send to completion
  // (plain `void sendWelcomeEmail()` is often cut off when the invocation ends).
  after(
    sendWelcomeEmail({
      to: formatUserEmail(username),
      name: welcomeDisplayName(username),
      userId,
    })
  );

  const res = NextResponse.json({
    recoveryKey,
    email: formatUserEmail(username),
  });
  attachSessionCookie(res, issued.token, issued.expiresAt);
  return res;
}
