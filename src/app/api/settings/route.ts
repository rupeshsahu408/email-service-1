import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  blockedSenders,
  labels,
  mailFilterRules,
  sessions,
  userSettings,
  users,
} from "@/db/schema";
import { formatUserEmail } from "@/lib/constants";
import { getAuthContext } from "@/lib/session";
import {
  getStorageThresholdState,
  getUserStorageSnapshot,
} from "@/lib/storage-quota";
import { ensureUserSettingsRow } from "@/lib/user-settings";

const patchSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  accentHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #5b4dff")
    .optional(),
  conversationView: z.boolean().optional(),
  unreadFirst: z.boolean().optional(),
  inboxDensity: z.enum(["compact", "comfortable"]).optional(),
  signatureHtml: z.string().max(16_000).optional(),
  composeFont: z
    .enum(["system", "serif", "sans", "mono"])
    .optional(),
  draftAutoSave: z.boolean().optional(),
  blockTrackers: z.boolean().optional(),
  readReceiptsOutgoing: z.boolean().optional(),
  externalImages: z.enum(["always", "ask", "never"]).optional(),
  notificationsEnabled: z.boolean().optional(),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user, session: current } = ctx;
  const db = getDb();

  const settings = await ensureUserSettingsRow(user.id);

  const sessionRows = await db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      lastUsedAt: sessions.lastUsedAt,
      userAgent: sessions.userAgent,
      ipHint: sessions.ipHint,
    })
    .from(sessions)
    .where(eq(sessions.userId, user.id))
    .orderBy(desc(sessions.lastUsedAt), desc(sessions.createdAt));

  const labelRows = await db
    .select({
      id: labels.id,
      name: labels.name,
      color: labels.color,
      createdAt: labels.createdAt,
    })
    .from(labels)
    .where(eq(labels.userId, user.id))
    .orderBy(desc(labels.createdAt));

  const blocked = await db
    .select({
      id: blockedSenders.id,
      email: blockedSenders.email,
      createdAt: blockedSenders.createdAt,
    })
    .from(blockedSenders)
    .where(eq(blockedSenders.userId, user.id))
    .orderBy(desc(blockedSenders.createdAt));

  const rules = await db
    .select({
      id: mailFilterRules.id,
      fromMatch: mailFilterRules.fromMatch,
      action: mailFilterRules.action,
      labelId: mailFilterRules.labelId,
      createdAt: mailFilterRules.createdAt,
    })
    .from(mailFilterRules)
    .where(eq(mailFilterRules.userId, user.id))
    .orderBy(desc(mailFilterRules.createdAt));

  const storageSnap = await getUserStorageSnapshot(db, user);
  const storageThreshold = getStorageThresholdState(storageSnap);

  const billingRow = await db
    .select({
      plan: users.plan,
      planStatus: users.planStatus,
      planExpiresAt: users.planExpiresAt,
      razorpaySubscriptionId: users.razorpaySubscriptionId,
      razorpayPlanId: users.razorpayPlanId,
      nextBillingAt: users.nextBillingAt,
      subscriptionAutoRenew: users.subscriptionAutoRenew,
      proPlanStatus: users.proPlanStatus,
      proPlanExpiresAt: users.proPlanExpiresAt,
      proRazorpaySubscriptionId: users.proRazorpaySubscriptionId,
      proRazorpayPlanId: users.proRazorpayPlanId,
      proNextBillingAt: users.proNextBillingAt,
      proSubscriptionAutoRenew: users.proSubscriptionAutoRenew,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .then((rows) => rows[0]);

  return NextResponse.json({
    user: {
      id: user.id,
      email: formatUserEmail(user.localPart),
      avatarUrl: user.avatarUrl ?? null,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
    settings,
    sessions: sessionRows.map((s) => ({
      ...s,
      isCurrent: s.id === current.id,
    })),
    labels: labelRows,
    blocked,
    rules,
    storage: {
      bytesUsed: storageSnap.usedBytes,
      messageCount: storageSnap.messageCount,
      attachmentBytes: storageSnap.breakdown.mailboxAttachmentBytes,
      approxBodyBytes: storageSnap.breakdown.mailboxContentBytes,
      limitBytes: storageSnap.limitBytes,
      remainingBytes: storageSnap.remainingBytes,
      effectivePlan: storageSnap.effectivePlan,
      breakdown: storageSnap.breakdown,
      usageLevel: storageThreshold.level,
      usageRatio: storageThreshold.usageRatio,
      usageMessage: storageThreshold.message,
    },
    billing: {
      plan: billingRow?.plan ?? "free",
      planStatus: billingRow?.planStatus ?? "free",
      planExpiresAt: billingRow?.planExpiresAt?.toISOString() ?? null,
      hasSubscription: Boolean(billingRow?.razorpaySubscriptionId),
      razorpayPlanId: billingRow?.razorpayPlanId ?? null,
      nextBillingAt: billingRow?.nextBillingAt?.toISOString() ?? null,
      subscriptionAutoRenew: billingRow?.subscriptionAutoRenew ?? true,
      proPlanStatus: billingRow?.proPlanStatus ?? "free",
      proPlanExpiresAt: billingRow?.proPlanExpiresAt?.toISOString() ?? null,
      hasProSubscription: Boolean(billingRow?.proRazorpaySubscriptionId),
      proRazorpayPlanId: billingRow?.proRazorpayPlanId ?? null,
      proNextBillingAt: billingRow?.proNextBillingAt?.toISOString() ?? null,
      proSubscriptionAutoRenew: billingRow?.proSubscriptionAutoRenew ?? true,
    },
  });
}

export async function PATCH(request: NextRequest) {
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  if (entries.length === 0) {
    return NextResponse.json({ ok: true });
  }
  await ensureUserSettingsRow(ctx.user.id);
  const payload = Object.fromEntries(entries);
  await getDb()
    .update(userSettings)
    .set({
      ...payload,
      updatedAt: new Date(),
    } as (typeof payload & { updatedAt: Date }) | Record<string, unknown>)
    .where(eq(userSettings.userId, ctx.user.id));
  const next = await ensureUserSettingsRow(ctx.user.id);
  return NextResponse.json({ ok: true, settings: next });
}
