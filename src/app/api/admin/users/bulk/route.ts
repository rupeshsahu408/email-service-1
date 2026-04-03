import { NextRequest, NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { adminBulkBodySchema } from "@/lib/validation";
import {
  adminSoftDeleteUser,
  adminSuspendUser,
  adminUnsuspendUser,
  adminSetEmailVerified,
} from "@/lib/admin-user-mutations";
import { recordAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = adminBulkBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { action, userIds } = parsed.data;
  const reason = parsed.data.action === "suspend" ? parsed.data.reason : undefined;

  if (userIds.includes(admin.id)) {
    return NextResponse.json(
      { error: "You cannot include your own account in this bulk action" },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, userIds));
  if (existing.length !== userIds.length) {
    return NextResponse.json(
      { error: "One or more users were not found" },
      { status: 404 }
    );
  }

  let processed = 0;
  for (const id of userIds) {
    try {
      if (action === "suspend") {
        await adminSuspendUser({
          actorUserId: admin.id,
          targetUserId: id,
          reason,
        });
      } else if (action === "unsuspend") {
        await adminUnsuspendUser({ actorUserId: admin.id, targetUserId: id });
      } else if (action === "verify") {
        await adminSetEmailVerified({
          actorUserId: admin.id,
          targetUserId: id,
          verified: true,
        });
      } else if (action === "delete") {
        await adminSoftDeleteUser({ actorUserId: admin.id, targetUserId: id });
      }
      processed += 1;
    } catch {
      // continue with others
    }
  }

  await recordAdminActivity({
    eventType: "admin_bulk_users",
    severity: "info",
    actorUserId: admin.id,
    detail: `Bulk ${action} on ${processed} user(s).`,
    meta: { action, count: processed },
  });

  return NextResponse.json({ ok: true, processed, action });
}
