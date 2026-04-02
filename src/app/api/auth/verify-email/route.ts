import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { ensureSessionSchema } from "@/lib/session";
import { sha256Hex } from "@/lib/password-reset";

function safeEqHex(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  await ensureSessionSchema();
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  const username = request.nextUrl.searchParams.get("username")?.trim().toLowerCase() ?? "";
  if (!token || !username) {
    return NextResponse.redirect(new URL("/login?verify=invalid", request.url));
  }

  const row = await getDb()
    .select({
      id: users.id,
      emailVerificationTokenHash: users.emailVerificationTokenHash,
      emailVerificationExpiresAt: users.emailVerificationExpiresAt,
    })
    .from(users)
    .where(eq(users.localPart, username))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (
    !row?.emailVerificationTokenHash ||
    !row.emailVerificationExpiresAt
  ) {
    return NextResponse.redirect(new URL("/login?verify=invalid", request.url));
  }

  if (new Date(row.emailVerificationExpiresAt).getTime() <= Date.now()) {
    return NextResponse.redirect(new URL("/login?verify=expired", request.url));
  }

  const providedHash = sha256Hex(token);
  if (!safeEqHex(row.emailVerificationTokenHash, providedHash)) {
    return NextResponse.redirect(new URL("/login?verify=invalid", request.url));
  }

  await getDb()
    .update(users)
    .set({
      emailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, row.id));

  return NextResponse.redirect(new URL("/login?verify=ok", request.url));
}
