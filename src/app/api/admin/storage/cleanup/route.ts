import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/session";
import {
  type AdminCleanupAction,
  getAdminCleanupPreview,
  runAdminCleanup,
} from "@/lib/admin-storage";

export const dynamic = "force-dynamic";

const actionSchema = z.enum([
  "empty_all_trash",
  "delete_deleted_messages",
  "clean_old_sent",
]);

const bodySchema = z.object({
  action: actionSchema,
  days: z.number().int().min(1).max(3650).optional(),
  confirmText: z.string().trim().optional(),
});

function actionNeedsDays(action: AdminCleanupAction): boolean {
  return action === "clean_old_sent";
}

export async function GET(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actionRaw = request.nextUrl.searchParams.get("action");
  const parsedAction = actionSchema.safeParse(actionRaw);
  if (!parsedAction.success) {
    return NextResponse.json({ error: "Invalid cleanup action" }, { status: 400 });
  }

  const daysRaw = request.nextUrl.searchParams.get("days");
  const daysParsed = daysRaw == null ? undefined : Number(daysRaw);
  if (daysRaw != null && (!Number.isFinite(daysParsed) || daysParsed < 1 || daysParsed > 3650)) {
    return NextResponse.json({ error: "days must be between 1 and 3650" }, { status: 400 });
  }
  if (actionNeedsDays(parsedAction.data) && daysParsed == null) {
    return NextResponse.json(
      { error: "days is required for clean_old_sent action" },
      { status: 400 }
    );
  }

  const preview = await getAdminCleanupPreview(parsedAction.data, daysParsed);
  return NextResponse.json({ ok: true, preview });
}

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid cleanup request" },
      { status: 400 }
    );
  }

  const { action, days, confirmText } = parsed.data;
  if (actionNeedsDays(action) && days == null) {
    return NextResponse.json(
      { error: "days is required for clean_old_sent action" },
      { status: 400 }
    );
  }
  if ((confirmText ?? "").toUpperCase() !== "CONFIRM") {
    return NextResponse.json(
      { error: 'Missing confirmation. Send confirmText: "CONFIRM".' },
      { status: 400 }
    );
  }

  const result = await runAdminCleanup({
    actorUserId: admin.id,
    action,
    days,
  });

  return NextResponse.json({ ok: true, result });
}
