import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { adminTriggerPasswordReset } from "@/lib/admin-user-mutations";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (id === admin.id) {
    return NextResponse.json(
      { error: "Use account settings to change your own password" },
      { status: 400 }
    );
  }

  const row = await getDb()
    .select({ localPart: users.localPart })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await adminTriggerPasswordReset({
    actorUserId: admin.id,
    targetUserId: id,
    localPart: row.localPart,
  });

  if (!result.emailSent) {
    return NextResponse.json(
      {
        ok: true,
        emailSent: false,
        warning:
          result.emailError ??
          "Email could not be sent. Reset token was issued and sessions were revoked.",
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true, emailSent: true });
}
