import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import {
  issueEmailVerificationTokenForUser,
  sendVerificationEmail,
} from "@/lib/admin-emails";
import { recordAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const row = await getDb()
    .select({ localPart: users.localPart })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const raw = await issueEmailVerificationTokenForUser(id);
  const sent = await sendVerificationEmail({
    localPart: row.localPart,
    rawToken: raw,
  });

  await recordAdminActivity({
    eventType: "admin_verification_resent",
    severity: "info",
    actorUserId: admin.id,
    subjectUserId: id,
    detail: sent.ok
      ? "Verification email resent by admin."
      : "Verification token issued (email not sent).",
    meta: { emailOk: sent.ok },
  });

  if (!sent.ok) {
    return NextResponse.json({
      ok: true,
      emailSent: false,
      warning:
        sent.error ??
        "Verification token was issued but email could not be sent. Configure RESEND_API_KEY.",
    });
  }

  return NextResponse.json({ ok: true, emailSent: true });
}
