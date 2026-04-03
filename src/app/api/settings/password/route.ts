import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getAuthContext } from "@/lib/session";
import { hashSecret, verifySecret } from "@/lib/password";
import { passwordSchema } from "@/lib/validation";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const ok = await verifySecret(
    ctx.user.passwordHash,
    parsed.data.currentPassword
  );
  if (!ok) {
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 400 }
    );
  }
  const newHash = await hashSecret(parsed.data.newPassword);
  await getDb()
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, ctx.user.id));
  return NextResponse.json({ ok: true });
}
