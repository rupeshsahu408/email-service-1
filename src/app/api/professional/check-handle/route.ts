import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { professionalProfiles } from "@/db/schema";
import { hasProfessionalPlan } from "@/lib/plan";
import {
  normalizeProfessionalHandle,
  professionalEmailForHandle,
} from "@/lib/professional-email";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Professional is coming soon; identity availability checks are disabled.
  return NextResponse.json(
    { error: "Professional Email is coming soon and is currently disabled." },
    { status: 503 }
  );
  const raw = new URL(request.url).searchParams.get("handle") ?? "";
  let handle: string;
  try {
    handle = normalizeProfessionalHandle(raw);
  } catch (e: unknown) {
    const msg = e instanceof Error ? (e as Error).message : "Invalid handle";
    return NextResponse.json(
      { available: false, error: msg },
      { status: 400 }
    );
  }

  const emailAddress = professionalEmailForHandle(handle);
  const rows = await getDb()
    .select({ userId: professionalProfiles.userId })
    .from(professionalProfiles)
    .where(
      and(
        eq(professionalProfiles.handle, handle),
        ne(professionalProfiles.userId, user!.id)
      )
    )
    .limit(1);
  const emailRows = await getDb()
    .select({ userId: professionalProfiles.userId })
    .from(professionalProfiles)
    .where(
      and(
        eq(professionalProfiles.emailAddress, emailAddress),
        ne(professionalProfiles.userId, user!.id)
      )
    )
    .limit(1);
  const available = rows.length === 0 && emailRows.length === 0;
  return NextResponse.json({ available, handle, emailAddress });
}
