import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { passkeyCredentials } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { ensurePasskeyTables } from "@/lib/passkeys";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensurePasskeyTables();

  const rows = await getDb()
    .select({ id: passkeyCredentials.id, createdAt: passkeyCredentials.createdAt })
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.userId, user.id));

  return NextResponse.json({
    ok: true,
    passkeys: rows.map((r) => ({ id: r.id, createdAt: r.createdAt })),
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensurePasskeyTables();

  await getDb().delete(passkeyCredentials).where(eq(passkeyCredentials.userId, user.id));
  return NextResponse.json({ ok: true });
}

