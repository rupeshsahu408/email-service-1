import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { businessProfiles, users } from "@/db/schema";
import { requireBusinessPlan, shouldShowGoldenTick } from "@/lib/plan";
import { getAuthContext } from "@/lib/session";

const patchSchema = z.object({
  businessName: z.string().max(256).optional(),
  displayNameDefault: z.string().max(256).optional(),
  logoUrl: z.string().max(2000).nullable().optional(),
  website: z.string().max(512).nullable().optional(),
  supportContact: z.string().max(320).nullable().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user } = ctx;
  const gate = requireBusinessPlan(user);
  if (gate !== true) {
    return NextResponse.json(
      { error: gate.error, code: gate.code },
      { status: gate.status }
    );
  }

  const db = getDb();
  const profile = await db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.userId, user.id))
    .limit(1);

  const billing = await db
    .select({
      plan: users.plan,
      planStatus: users.planStatus,
      planExpiresAt: users.planExpiresAt,
      nextBillingAt: users.nextBillingAt,
      billingPeriodStart: users.billingPeriodStart,
      subscriptionAutoRenew: users.subscriptionAutoRenew,
      razorpaySubscriptionId: users.razorpaySubscriptionId,
      razorpayPlanId: users.razorpayPlanId,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .then((r) => r[0]);

  const goldenTickEligible = shouldShowGoldenTick(user);

  return NextResponse.json({
    profile: profile[0] ?? null,
    billing: billing ?? null,
    goldenTickEligible,
  });
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user } = ctx;
  const gate = requireBusinessPlan(user);
  if (gate !== true) {
    return NextResponse.json(
      { error: gate.error, code: gate.code },
      { status: gate.status }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = await db
    .select({ userId: businessProfiles.userId })
    .from(businessProfiles)
    .where(eq(businessProfiles.userId, user.id))
    .limit(1);

  const data = parsed.data;
  const now = new Date();

  if (existing.length === 0) {
    await db.insert(businessProfiles).values({
      userId: user.id,
      businessName: data.businessName ?? "",
      displayNameDefault: data.displayNameDefault ?? "",
      logoUrl: data.logoUrl ?? null,
      website: data.website ?? null,
      supportContact: data.supportContact ?? null,
      brandColor: data.brandColor ?? null,
      updatedAt: now,
    });
  } else {
    const updates: {
      updatedAt: Date;
      businessName?: string;
      displayNameDefault?: string;
      logoUrl?: string | null;
      website?: string | null;
      supportContact?: string | null;
      brandColor?: string | null;
    } = { updatedAt: now };
    if (data.businessName !== undefined) updates.businessName = data.businessName;
    if (data.displayNameDefault !== undefined)
      updates.displayNameDefault = data.displayNameDefault;
    if (data.logoUrl !== undefined) updates.logoUrl = data.logoUrl;
    if (data.website !== undefined) updates.website = data.website;
    if (data.supportContact !== undefined)
      updates.supportContact = data.supportContact;
    if (data.brandColor !== undefined) updates.brandColor = data.brandColor;
    await db.update(businessProfiles).set(updates).where(eq(businessProfiles.userId, user.id));
  }

  const goldenTickEligible = shouldShowGoldenTick(user);
  return NextResponse.json({ ok: true, goldenTickEligible });
}
