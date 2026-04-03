import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getAuthContext } from "@/lib/session";
import { hashSecret, verifySecret } from "@/lib/password";

const bodySchema = z.object({
  password: z.string().min(1),
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
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const passOk = await verifySecret(
    ctx.user.passwordHash,
    parsed.data.password
  );
  if (!passOk) {
    return NextResponse.json({ error: "Password is incorrect." }, { status: 400 });
  }
  const recoveryKey = randomBytes(32).toString("hex");
  const recoveryKeyHash = await hashSecret(recoveryKey);
  await getDb()
    .update(users)
    .set({ recoveryKeyHash })
    .where(eq(users.id, ctx.user.id));
  return NextResponse.json({
    ok: true,
    recoveryKey,
    notice:
      "Save this key in a safe place. Previous recovery keys no longer work.",
  });
}
