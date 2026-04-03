import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getEmailDomain } from "@/lib/constants";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { adminPatchUserBodySchema } from "@/lib/validation";
import { getAdminUserDetail } from "@/lib/admin-users";
import {
  adminSoftDeleteUser,
  adminSuspendUser,
  adminUnsuspendUser,
} from "@/lib/admin-user-mutations";
import { recordAdminActivity } from "@/lib/admin-activity";
import { isReservedUsername } from "@/lib/reserved-usernames";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const detail = await getAdminUserDetail(id);
    return NextResponse.json({ user: detail });
  } catch (e) {
    if (e instanceof Error && e.message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (id === admin.id) {
    return NextResponse.json(
      { error: "Use account settings to change your own admin profile" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = adminPatchUserBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const row = await getDb()
    .select({
      id: users.id,
      localPart: users.localPart,
      isSuspended: users.isSuspended,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const d = parsed.data;
  const domain = getEmailDomain().toLowerCase();

  if (d.email) {
    const emailNorm = d.email.trim().toLowerCase();
    const at = emailNorm.lastIndexOf("@");
    if (at <= 0) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    const localPart = emailNorm.slice(0, at).toLowerCase();
    const emailDomain = emailNorm.slice(at + 1);
    if (emailDomain !== domain) {
      return NextResponse.json(
        { error: `Email must use @${domain}` },
        { status: 400 }
      );
    }
    if (localPart !== row.localPart && isReservedUsername(localPart)) {
      return NextResponse.json(
        { error: "This username is reserved" },
        { status: 400 }
      );
    }
    if (localPart !== row.localPart) {
      const clash = await getDb()
        .select({ id: users.id })
        .from(users)
        .where(eq(users.localPart, localPart))
        .limit(1);
      if (clash.length > 0) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        );
      }
    }
  }

  if (d.accountStatus === "deleted") {
    await adminSoftDeleteUser({ actorUserId: admin.id, targetUserId: id });
    return NextResponse.json({ ok: true });
  }

  if (d.accountStatus === "suspended") {
    await adminSuspendUser({
      actorUserId: admin.id,
      targetUserId: id,
      reason: "Suspended via edit",
    });
  } else if (d.accountStatus === "active") {
    if (row.deletedAt) {
      return NextResponse.json(
        { error: "Cannot restore deleted users from this form" },
        { status: 400 }
      );
    }
    if (row.isSuspended) {
      await adminUnsuspendUser({ actorUserId: admin.id, targetUserId: id });
    }
  }

  const now = new Date();
  const updates: Partial<typeof users.$inferInsert> = { updatedAt: now };

  if (d.fullName !== undefined) updates.fullName = d.fullName.trim();
  if (d.email !== undefined) {
    const emailNorm = d.email.trim().toLowerCase();
    const at = emailNorm.lastIndexOf("@");
    const localPart = emailNorm.slice(0, at).toLowerCase();
    updates.localPart = localPart;
  }
  if (d.plan !== undefined) updates.plan = d.plan;
  if (d.accountType !== undefined) updates.accountType = d.accountType;
  if (d.emailVerified !== undefined) {
    updates.emailVerified = d.emailVerified;
    if (d.emailVerified) {
      updates.emailVerificationTokenHash = null;
      updates.emailVerificationExpiresAt = null;
    }
  }
  if (d.storageQuotaBytes !== undefined) {
    updates.storageQuotaBytes = d.storageQuotaBytes;
  }
  if (d.adminNotes !== undefined) updates.adminNotes = d.adminNotes;
  if (d.isAdmin !== undefined) updates.isAdmin = d.isAdmin;

  const keys = Object.keys(updates).filter((k) => k !== "updatedAt");
  if (keys.length > 0) {
    await getDb().update(users).set(updates).where(eq(users.id, id));
  }

  await recordAdminActivity({
    eventType: "admin_user_updated",
    severity: "info",
    actorUserId: admin.id,
    subjectUserId: id,
    detail: "User updated by admin.",
    meta: { fields: keys },
  });

  const detail = await getAdminUserDetail(id);
  return NextResponse.json({ ok: true, user: detail });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (id === admin.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 }
    );
  }

  const exists = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (exists.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await adminSoftDeleteUser({ actorUserId: admin.id, targetUserId: id });
  return NextResponse.json({ ok: true });
}
