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

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Professional is coming soon; profile endpoints are disabled.
  return NextResponse.json(
    { error: "Professional Email is coming soon and is currently disabled." },
    { status: 503 }
  );
  const row = await getDb()
    .select()
    .from(professionalProfiles)
    .where(eq(professionalProfiles.userId, user!.id))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  return NextResponse.json({ profile: row });
}

async function upsert(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Professional is coming soon; profile endpoints are disabled.
  return NextResponse.json(
    { error: "Professional Email is coming soon and is currently disabled." },
    { status: 503 }
  );
  if (!hasProfessionalPlan(user!)) {
    return NextResponse.json(
      { error: "Professional plan required." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const rawHandle = (body as { handle?: string })?.handle ?? "";
  let handle: string;
  try {
    handle = normalizeProfessionalHandle(rawHandle);
  } catch (e: unknown) {
    const msg = e instanceof Error ? (e as Error).message : "Invalid handle";
    return NextResponse.json(
      { error: msg },
      { status: 400 }
    );
  }

  const emailAddress = professionalEmailForHandle(handle);
  const taken = await getDb()
    .select({ userId: professionalProfiles.userId })
    .from(professionalProfiles)
    .where(
      and(
        eq(professionalProfiles.handle, handle),
        ne(professionalProfiles.userId, user!.id)
      )
    )
    .limit(1);
  if (taken.length > 0) {
    return NextResponse.json({ error: "Handle already taken." }, { status: 409 });
  }

  const existing = await getDb()
    .select({ userId: professionalProfiles.userId })
    .from(professionalProfiles)
    .where(eq(professionalProfiles.userId, user!.id))
    .limit(1);

  if (existing.length === 0) {
    await getDb().insert(professionalProfiles).values({
      userId: user!.id,
      handle,
      emailAddress,
      updatedAt: new Date(),
      createdAt: new Date(),
    });
  } else {
    await getDb()
      .update(professionalProfiles)
      .set({
        handle,
        emailAddress,
        updatedAt: new Date(),
      })
      .where(eq(professionalProfiles.userId, user!.id));
  }

  return NextResponse.json({
    ok: true,
    profile: { userId: user!.id, handle, emailAddress },
  });
}

export async function POST(request: NextRequest) {
  return upsert(request);
}

export async function PATCH(request: NextRequest) {
  return upsert(request);
}
