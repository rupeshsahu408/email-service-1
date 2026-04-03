import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { verifySecret } from "@/lib/password";
import { getClientIp, rateLimitRecoveryVerify } from "@/lib/rate-limit";
import { ensurePasswordResetColumns, sha256Hex } from "@/lib/password-reset";

const bodySchema = z.object({
  username: z.string().max(64).optional().default(""),
  backupText: z.string().min(1).max(100_000),
});

function parseBackup(
  backupText: string
): { username?: string; recoveryKey?: string } | null {
  const raw = backupText.trim();
  if (!raw) return null;

  // Preferred format: JSON backup file.
  // We keep this flexible because Phase 1 only needs verification.
  try {
    const json = JSON.parse(raw) as unknown;
    const parsed = z
      .object({
        username: z.string().min(1).max(64).optional(),
        localPart: z.string().min(1).max(64).optional(),
        recoveryKey: z.string().min(1).max(512).optional(),
        key: z.string().min(1).max(512).optional(),
      })
      .safeParse(json);
    if (parsed.success) {
      return {
        username: parsed.data.username ?? parsed.data.localPart ?? undefined,
        recoveryKey: parsed.data.recoveryKey ?? parsed.data.key ?? undefined,
      };
    }
  } catch {
    // Not JSON; fall back to plain recovery key text.
  }

  // Plain-text fallback: user pastes a recovery key.
  return { recoveryKey: raw };
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const { success } = await rateLimitRecoveryVerify(ip);
  if (!success) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const fromBackup = parseBackup(parsedBody.data.backupText);
  const username =
    (fromBackup?.username ?? parsedBody.data.username).trim().toLowerCase();
  const recoveryKey = (fromBackup?.recoveryKey ?? "").trim();

  // Avoid user enumeration: return a generic "invalid backup" error for not found or mismatch.
  if (!username || !recoveryKey) {
    return NextResponse.json(
      { error: "Invalid backup file. Please try again." },
      { status: 400 }
    );
  }

  await ensurePasswordResetColumns();

  const row = await getDb()
    .select({
      id: users.id,
      recoveryKeyHash: users.recoveryKeyHash,
      passwordResetTokenHash: users.passwordResetTokenHash,
      passwordResetTokenExpiresAt: users.passwordResetTokenExpiresAt,
      passwordResetTokenUsedAt: users.passwordResetTokenUsedAt,
    })
    .from(users)
    .where(eq(users.localPart, username))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) {
    return NextResponse.json(
      { error: "Invalid backup file. Please try again." },
      { status: 400 }
    );
  }

  const ok = await verifySecret(row.recoveryKeyHash, recoveryKey);
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid backup file. Please try again." },
      { status: 400 }
    );
  }

  // Reuse an active, unused reset session to avoid token churn on repeated verification clicks.
  const currentExp = row.passwordResetTokenExpiresAt
    ? new Date(row.passwordResetTokenExpiresAt).getTime()
    : NaN;
  const canReuse =
    Boolean(row.passwordResetTokenHash) &&
    !row.passwordResetTokenUsedAt &&
    Number.isFinite(currentExp) &&
    currentExp > Date.now();

  if (canReuse) {
    return NextResponse.json({
      ok: true,
      resetToken: null,
      expiresAt: new Date(currentExp).toISOString(),
      message: "Reset already started. Continue from your current reset page.",
    });
  }

  const resetToken = randomBytes(32).toString("hex");
  const resetTokenHash = sha256Hex(resetToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await getDb()
    .update(users)
    .set({
      passwordResetTokenHash: resetTokenHash,
      passwordResetTokenExpiresAt: expiresAt,
      passwordResetTokenUsedAt: null,
    })
    .where(eq(users.id, row.id));

  return NextResponse.json({
    ok: true,
    resetToken,
    expiresAt: expiresAt.toISOString(),
  });
}

