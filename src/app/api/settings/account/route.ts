import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { formatUserEmail } from "@/lib/constants";
import { getAuthContext, clearSessionCookieOnResponse } from "@/lib/session";
import { verifySecret } from "@/lib/password";

const deleteSchema = z.object({
  password: z.string().min(1),
  confirmEmail: z.string().min(3),
});

export async function DELETE(request: NextRequest) {
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
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const email = formatUserEmail(ctx.user.localPart);
  if (parsed.data.confirmEmail.trim().toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json(
      { error: "Type your full email exactly to confirm." },
      { status: 400 }
    );
  }
  const passOk = await verifySecret(ctx.user.passwordHash, parsed.data.password);
  if (!passOk) {
    return NextResponse.json(
      { error: "Password is incorrect." },
      { status: 400 }
    );
  }
  await getDb().delete(users).where(eq(users.id, ctx.user.id));
  const res = NextResponse.json({ ok: true });
  clearSessionCookieOnResponse(res);
  return res;
}
