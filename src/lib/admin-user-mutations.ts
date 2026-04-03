import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { recordAdminActivity } from "@/lib/admin-activity";
import {
  issuePasswordResetTokenForUser,
  sendAdminPasswordResetEmail,
} from "@/lib/admin-emails";

export async function revokeAllSessions(userId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}

export async function adminSuspendUser(input: {
  actorUserId: string;
  targetUserId: string;
  reason?: string;
}): Promise<void> {
  const now = new Date();
  await getDb()
    .update(users)
    .set({
      isSuspended: true,
      suspendedAt: now,
      suspensionReason: input.reason?.trim() || null,
      updatedAt: now,
    })
    .where(eq(users.id, input.targetUserId));
  await revokeAllSessions(input.targetUserId);
  await recordAdminActivity({
    eventType: "admin_user_suspended",
    severity: "warning",
    actorUserId: input.actorUserId,
    subjectUserId: input.targetUserId,
    detail: "User suspended by admin.",
    meta: { reason: input.reason ?? null },
  });
}

export async function adminUnsuspendUser(input: {
  actorUserId: string;
  targetUserId: string;
}): Promise<void> {
  const now = new Date();
  await getDb()
    .update(users)
    .set({
      isSuspended: false,
      suspendedAt: null,
      suspensionReason: null,
      updatedAt: now,
    })
    .where(eq(users.id, input.targetUserId));
  await recordAdminActivity({
    eventType: "admin_user_unsuspended",
    severity: "info",
    actorUserId: input.actorUserId,
    subjectUserId: input.targetUserId,
    detail: "User unsuspended by admin.",
  });
}

export async function adminSoftDeleteUser(input: {
  actorUserId: string;
  targetUserId: string;
}): Promise<void> {
  const now = new Date();
  await getDb()
    .update(users)
    .set({
      deletedAt: now,
      isSuspended: true,
      updatedAt: now,
    })
    .where(eq(users.id, input.targetUserId));
  await revokeAllSessions(input.targetUserId);
  await recordAdminActivity({
    eventType: "admin_user_deleted",
    severity: "warning",
    actorUserId: input.actorUserId,
    subjectUserId: input.targetUserId,
    detail: "User soft-deleted by admin.",
  });
}

export async function adminSetEmailVerified(input: {
  actorUserId: string;
  targetUserId: string;
  verified: boolean;
}): Promise<void> {
  const now = new Date();
  await getDb()
    .update(users)
    .set({
      emailVerified: input.verified,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
      updatedAt: now,
    })
    .where(eq(users.id, input.targetUserId));
  await recordAdminActivity({
    eventType: input.verified
      ? "admin_email_verified"
      : "admin_email_unverified",
    severity: "info",
    actorUserId: input.actorUserId,
    subjectUserId: input.targetUserId,
    detail: input.verified
      ? "Email marked verified by admin."
      : "Email marked unverified by admin.",
  });
}

export async function adminTriggerPasswordReset(input: {
  actorUserId: string;
  targetUserId: string;
  localPart: string;
}): Promise<{ emailSent: boolean; emailError?: string }> {
  await revokeAllSessions(input.targetUserId);
  const raw = await issuePasswordResetTokenForUser(input.targetUserId);
  const sent = await sendAdminPasswordResetEmail({
    localPart: input.localPart,
    rawToken: raw,
  });
  await recordAdminActivity({
    eventType: "admin_password_reset_issued",
    severity: "info",
    actorUserId: input.actorUserId,
    subjectUserId: input.targetUserId,
    detail: sent.ok
      ? "Admin triggered password reset; email sent."
      : "Admin triggered password reset; email not sent.",
    meta: { emailOk: sent.ok },
  });
  return sent.ok
    ? { emailSent: true }
    : { emailSent: false, emailError: sent.error };
}

export async function appendAdminNote(input: {
  targetUserId: string;
  text: string;
}): Promise<void> {
  const row = await getDb()
    .select({ adminNotes: users.adminNotes })
    .from(users)
    .where(eq(users.id, input.targetUserId))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!row) throw new Error("USER_NOT_FOUND");
  const stamp = new Date().toISOString();
  const line = `[${stamp}] ${input.text.trim()}\n`;
  const next = (row.adminNotes ?? "").trim()
    ? `${row.adminNotes?.trim()}\n\n${line}`
    : line;
  await getDb()
    .update(users)
    .set({ adminNotes: next, updatedAt: new Date() })
    .where(eq(users.id, input.targetUserId));
}

export async function revokeSessionsForUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await getDb().delete(sessions).where(inArray(sessions.userId, userIds));
}

const DEFAULT_SECURITY_LOCK_MS = 7 * 24 * 60 * 60 * 1000;

export async function adminSecurityLockUser(input: {
  actorUserId: string;
  targetUserId: string;
  lockedUntil?: Date;
  reason?: string;
}): Promise<void> {
  const until =
    input.lockedUntil ??
    new Date(Date.now() + DEFAULT_SECURITY_LOCK_MS);
  const now = new Date();
  await getDb()
    .update(users)
    .set({
      securityLockedUntil: until,
      securityLockReason: input.reason?.trim() || "Security lock by admin",
      updatedAt: now,
    })
    .where(eq(users.id, input.targetUserId));
  await revokeAllSessions(input.targetUserId);
  await recordAdminActivity({
    eventType: "admin_security_lock",
    severity: "warning",
    actorUserId: input.actorUserId,
    subjectUserId: input.targetUserId,
    detail: "Temporary security lock applied.",
    meta: { lockedUntil: until.toISOString() },
  });
}

export async function adminSecurityUnlockUser(input: {
  actorUserId: string;
  targetUserId: string;
}): Promise<void> {
  const now = new Date();
  await getDb()
    .update(users)
    .set({
      securityLockedUntil: null,
      securityLockReason: null,
      updatedAt: now,
    })
    .where(eq(users.id, input.targetUserId));
  await recordAdminActivity({
    eventType: "admin_security_unlock",
    severity: "info",
    actorUserId: input.actorUserId,
    subjectUserId: input.targetUserId,
    detail: "Security lock cleared.",
  });
}
