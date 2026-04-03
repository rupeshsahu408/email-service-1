import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { logError } from "@/lib/logger";
import { registrationUsernameSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("username") ?? "";
  const parsed = registrationUsernameSchema.safeParse(raw.trim());
  if (!parsed.success) {
    return NextResponse.json(
      { available: false, error: parsed.error.issues[0]?.message ?? "Invalid" },
      { status: 400 }
    );
  }
  const username = parsed.data.toLowerCase();
  try {
    const existing = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.localPart, username))
      .limit(1);
    return NextResponse.json({ available: existing.length === 0, username });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Database error";
    logError("auth_username_check_failed", { message });
    return NextResponse.json(
      {
        available: false,
        error:
          "Server could not check availability. Is DATABASE_URL set and the database running?",
      },
      { status: 503 }
    );
  }
}
