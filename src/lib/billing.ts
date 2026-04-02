import { and, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  billingPayments,
  billingSubscriptions,
  BillingInterval,
  BillingProductType,
} from "@/db/schema";
import { logError, logInfo } from "@/lib/logger";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "authenticated", "created"] as const;
const SUCCESS_PAYMENT_STATUSES = ["captured", "success"] as const;

type PlanMapping = {
  productType: BillingProductType;
  interval: BillingInterval;
  planId: string;
  totalCount: number;
};

function getPlanIdFromEnv(keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function getRazorpayPlanMapping(input: {
  productType: BillingProductType;
  interval?: "monthly" | "yearly";
}): PlanMapping {
  const interval = input.interval ?? "monthly";
  if (input.productType === "business_email") {
    const planId =
      interval === "yearly"
        ? getPlanIdFromEnv(["RAZORPAY_BUSINESS_EMAIL_YEARLY_PLAN_ID"])
        : getPlanIdFromEnv([
            "RAZORPAY_BUSINESS_EMAIL_MONTHLY_PLAN_ID",
            "RAZORPAY_BUSINESS_PLAN_ID",
            "RAZORPAY_PLAN_ID",
          ]);
    return {
      productType: input.productType,
      interval,
      planId,
      totalCount: interval === "yearly" ? 10 : 120,
    };
  }

  if (input.productType === "temporary_inbox") {
    const planId =
      interval === "yearly"
        ? getPlanIdFromEnv(["RAZORPAY_TEMP_INBOX_YEARLY_PLAN_ID"])
        : getPlanIdFromEnv([
            "RAZORPAY_TEMP_INBOX_MONTHLY_PLAN_ID",
            "RAZORPAY_TEMP_INBOX_PLAN_ID",
          ]);
    return {
      productType: input.productType,
      interval,
      planId,
      totalCount: interval === "yearly" ? 10 : 120,
    };
  }

  const planId =
    interval === "yearly"
      ? getPlanIdFromEnv(["RAZORPAY_PROFESSIONAL_YEARLY_PLAN_ID"])
      : getPlanIdFromEnv(["RAZORPAY_PROFESSIONAL_MONTHLY_PLAN_ID", "RAZORPAY_PRO_PLAN_ID"]);
  return {
    productType: input.productType,
    interval,
    planId,
    totalCount: interval === "yearly" ? 10 : 120,
  };
}

export function getProductTypeFromSubscription(sub: {
  plan_id?: string;
  notes?: Record<string, string>;
} | null): BillingProductType {
  const kind = sub?.notes?.kind;
  if (kind === "temp_inbox") return "temporary_inbox";
  if (kind === "professional") return "professional_email";
  return "business_email";
}

export function getIntervalFromSubscription(sub: {
  notes?: Record<string, string>;
} | null): BillingInterval {
  const interval = sub?.notes?.interval;
  if (interval === "yearly") return "yearly";
  if (interval === "weekly") return "weekly";
  return "monthly";
}

export async function upsertBillingSubscription(input: {
  userId: string;
  productType: BillingProductType;
  interval: BillingInterval;
  providerSubscriptionId: string;
  providerPlanId?: string | null;
  status: string;
  autoRenew?: boolean;
  currentStartAt?: Date | null;
  currentEndAt?: Date | null;
  nextBillingAt?: Date | null;
  cancelledAt?: Date | null;
  metadata?: Record<string, unknown>;
}) {
  const db = getDb();
  await db
    .insert(billingSubscriptions)
    .values({
      userId: input.userId,
      productType: input.productType,
      interval: input.interval,
      providerSubscriptionId: input.providerSubscriptionId,
      providerPlanId: input.providerPlanId ?? null,
      status: input.status,
      autoRenew: input.autoRenew ?? true,
      currentStartAt: input.currentStartAt ?? null,
      currentEndAt: input.currentEndAt ?? null,
      nextBillingAt: input.nextBillingAt ?? null,
      cancelAtCycleEnd: input.autoRenew === false,
      cancelledAt: input.cancelledAt ?? null,
      metadata: input.metadata ?? {},
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: billingSubscriptions.providerSubscriptionId,
      set: {
        userId: input.userId,
        productType: input.productType,
        interval: input.interval,
        providerPlanId: input.providerPlanId ?? null,
        status: input.status,
        autoRenew: input.autoRenew ?? true,
        currentStartAt: input.currentStartAt ?? null,
        currentEndAt: input.currentEndAt ?? null,
        nextBillingAt: input.nextBillingAt ?? null,
        cancelAtCycleEnd: input.autoRenew === false,
        cancelledAt: input.cancelledAt ?? null,
        metadata: input.metadata ?? {},
        updatedAt: new Date(),
      },
    });
  logInfo("billing_subscription_upserted", {
    userId: input.userId,
    productType: input.productType,
    interval: input.interval,
    status: input.status,
  });
}

export async function upsertBillingPayment(input: {
  userId: string;
  productType: BillingProductType;
  interval: BillingInterval;
  providerPaymentId: string;
  providerOrderId?: string | null;
  providerSubscriptionId?: string | null;
  providerPlanId?: string | null;
  amount: number;
  currency: string;
  status: string;
  capturedAt?: Date | null;
  failedReason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const db = getDb();
  await db
    .insert(billingPayments)
    .values({
      userId: input.userId,
      productType: input.productType,
      interval: input.interval,
      providerPaymentId: input.providerPaymentId,
      providerOrderId: input.providerOrderId ?? null,
      providerSubscriptionId: input.providerSubscriptionId ?? null,
      providerPlanId: input.providerPlanId ?? null,
      amount: input.amount,
      currency: input.currency,
      status: input.status,
      capturedAt: input.capturedAt ?? null,
      failedReason: input.failedReason ?? null,
      metadata: input.metadata ?? {},
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: billingPayments.providerPaymentId,
      set: {
        userId: input.userId,
        productType: input.productType,
        interval: input.interval,
        providerOrderId: input.providerOrderId ?? null,
        providerSubscriptionId: input.providerSubscriptionId ?? null,
        providerPlanId: input.providerPlanId ?? null,
        amount: input.amount,
        currency: input.currency,
        status: input.status,
        capturedAt: input.capturedAt ?? null,
        failedReason: input.failedReason ?? null,
        metadata: input.metadata ?? {},
        updatedAt: new Date(),
      },
    });
  logInfo("billing_payment_upserted", {
    userId: input.userId,
    productType: input.productType,
    amount: input.amount,
    status: input.status,
  });
}

export async function getBillingMetricsUtc(now = new Date()) {
  const db = getDb();
  const utcDayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const utcMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextUtcDayStart = new Date(utcDayStart.getTime() + 24 * 60 * 60 * 1000);
  const nextUtcMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );

  const successStatusExpr = inArray(
    billingPayments.status,
    SUCCESS_PAYMENT_STATUSES as unknown as string[]
  );
  const activeSubscriptionExpr = inArray(
    billingSubscriptions.status,
    ACTIVE_SUBSCRIPTION_STATUSES as unknown as string[]
  );

  try {
    const [totalsRow, byProductRows, paidUsersRows, failedPaymentsRows] = await Promise.all([
      db
        .select({
          totalRevenue: sql<number>`coalesce(sum(case when ${successStatusExpr} then ${billingPayments.amount} else 0 end), 0)`,
          todayRevenue: sql<number>`coalesce(sum(case when ${successStatusExpr} and ${billingPayments.capturedAt} >= ${utcDayStart} and ${billingPayments.capturedAt} < ${nextUtcDayStart} then ${billingPayments.amount} else 0 end), 0)`,
          monthRevenue: sql<number>`coalesce(sum(case when ${successStatusExpr} and ${billingPayments.capturedAt} >= ${utcMonthStart} and ${billingPayments.capturedAt} < ${nextUtcMonthStart} then ${billingPayments.amount} else 0 end), 0)`,
        })
        .from(billingPayments),
      db
        .select({
          productType: billingPayments.productType,
          revenue: sql<number>`coalesce(sum(case when ${successStatusExpr} then ${billingPayments.amount} else 0 end), 0)`,
        })
        .from(billingPayments)
        .groupBy(billingPayments.productType),
      db.execute(sql`
        select count(distinct paid.user_id)::int as c
        from (
          select ${billingPayments.userId} as user_id
          from ${billingPayments}
          where ${successStatusExpr}
          union
          select ${billingSubscriptions.userId} as user_id
          from ${billingSubscriptions}
          where ${activeSubscriptionExpr}
        ) paid
      `),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(billingPayments)
        .where(eq(billingPayments.status, "failed")),
    ]);

    const productMap = new Map<BillingProductType, number>();
    for (const row of byProductRows) {
      productMap.set(row.productType, Number(row.revenue ?? 0));
    }

    const paidUsers =
      Number(
        ((paidUsersRows as unknown as { rows?: Array<{ c: number }> }).rows ?? [])[0]?.c ?? 0
      ) || 0;

    const metrics = {
      totalRevenue: Number(totalsRow[0]?.totalRevenue ?? 0),
      todayRevenueUtc: Number(totalsRow[0]?.todayRevenue ?? 0),
      thisMonthRevenueUtc: Number(totalsRow[0]?.monthRevenue ?? 0),
      businessEmailRevenue: Number(productMap.get("business_email") ?? 0),
      temporaryInboxRevenue: Number(productMap.get("temporary_inbox") ?? 0),
      totalPaidUsers: paidUsers,
      failedPayments: Number(failedPaymentsRows[0]?.c ?? 0),
    };
    logInfo("billing_metrics_computed", {
      totalRevenue: metrics.totalRevenue,
      todayRevenueUtc: metrics.todayRevenueUtc,
      thisMonthRevenueUtc: metrics.thisMonthRevenueUtc,
      failedPayments: metrics.failedPayments,
      totalPaidUsers: metrics.totalPaidUsers,
    });
    return metrics;
  } catch (error) {
    logError("billing_metrics_query_failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      totalRevenue: 0,
      todayRevenueUtc: 0,
      thisMonthRevenueUtc: 0,
      businessEmailRevenue: 0,
      temporaryInboxRevenue: 0,
      totalPaidUsers: 0,
      failedPayments: 0,
    };
  }
}

export async function findSubscriptionByProviderId(providerSubscriptionId: string) {
  const rows = await getDb()
    .select()
    .from(billingSubscriptions)
    .where(eq(billingSubscriptions.providerSubscriptionId, providerSubscriptionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function findAnySubscriptionForPayment(input: {
  providerSubscriptionId?: string | null;
  providerPlanId?: string | null;
  userId: string;
}) {
  const where = [];
  if (input.providerSubscriptionId) {
    where.push(eq(billingSubscriptions.providerSubscriptionId, input.providerSubscriptionId));
  }
  if (input.providerPlanId) {
    where.push(eq(billingSubscriptions.providerPlanId, input.providerPlanId));
  }
  where.push(eq(billingSubscriptions.userId, input.userId));
  const rows = await getDb()
    .select()
    .from(billingSubscriptions)
    .where(and(eq(billingSubscriptions.userId, input.userId), or(...where)))
    .limit(1);
  return rows[0] ?? null;
}
