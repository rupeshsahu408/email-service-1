import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { timingSafeEqual } from "crypto";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { hashSecret } from "@/lib/password";
import { getClientIp, rateLimitRecoveryReset } from "@/lib/rate-limit";
import { ensurePasswordResetColumns, sha256Hex } from "@/lib/password-reset";
import { getAdminSystemSettings } from "@/lib/admin-system-settings";

const bodySchema = z.object({
  username: z.string().min(1).max(64),
  token: z.string().min(1).max(512),
  newPassword: z.string().min(1),
});

function safeEqHex(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const settings = await getAdminSystemSettings();
  const ip = getClientIp(request.headers);
  const { success } = await rateLimitRecoveryReset(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
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
  if (parsed.data.newPassword.length < settings.security.minPasswordLength) {
    return NextResponse.json(
      { error: `Password must be at least ${settings.security.minPasswordLength} characters.` },
      { status: 400 }
    );
  }

  await ensurePasswordResetColumns();

  const username = parsed.data.username.trim().toLowerCase();
  const token = parsed.data.token.trim();

  const row = await getDb()
    .select({
      id: users.id,
      passwordResetTokenHash: users.passwordResetTokenHash,
      passwordResetTokenExpiresAt: users.passwordResetTokenExpiresAt,
      passwordResetTokenUsedAt: users.passwordResetTokenUsedAt,
    })
    .from(users)
    .where(eq(users.localPart, username))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const invalidMsg =
    "Your password reset session is invalid or expired. Please verify your backup file again.";

  if (!row?.passwordResetTokenHash || !row.passwordResetTokenExpiresAt) {
    return NextResponse.json({ error: invalidMsg }, { status: 400 });
  }
  if (row.passwordResetTokenUsedAt) {
    return NextResponse.json({ error: invalidMsg }, { status: 400 });
  }
  const exp = new Date(row.passwordResetTokenExpiresAt).getTime();
  if (!Number.isFinite(exp) || exp <= Date.now()) {
    return NextResponse.json({ error: invalidMsg }, { status: 400 });
  }

  const providedHash = sha256Hex(token);
  const ok = safeEqHex(row.passwordResetTokenHash, providedHash);
  if (!ok) {
    return NextResponse.json({ error: invalidMsg }, { status: 400 });
  }

  const passwordHash = await hashSecret(parsed.data.newPassword);
  const now = new Date();

  await getDb()
    .update(users)
    .set({
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
      passwordResetTokenUsedAt: now,
    })
    .where(eq(users.id, row.id));

  // Invalidate sessions so the account isn't left logged in elsewhere.
  await getDb().delete(sessions).where(eq(sessions.userId, row.id));

  return NextResponse.json({ ok: true });
}

