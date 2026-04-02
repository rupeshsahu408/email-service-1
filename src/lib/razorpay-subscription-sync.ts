import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import {
  fetchRazorpaySubscription,
  nextBillingAtFromSubscription,
  planExpiresAtFromSubscription,
  RAZORPAY_PLAN_DAYS,
  subscriptionAutoRenewFromEntity,
} from "@/lib/razorpay";

export async function syncUserSubscriptionFromRazorpay(
  userId: string,
  subscriptionId: string,
  options?: { planStatus?: string }
): Promise<void> {
  const sub = await fetchRazorpaySubscription(subscriptionId);
  const planExpiresAt =
    planExpiresAtFromSubscription(sub) ??
    new Date(Date.now() + RAZORPAY_PLAN_DAYS * 24 * 60 * 60 * 1000);
  const nextBillingAt = nextBillingAtFromSubscription(sub);
  await getDb()
    .update(users)
    .set({
      plan: "business",
      planStatus: options?.planStatus ?? "active",
      planExpiresAt,
      razorpaySubscriptionId: subscriptionId,
      razorpayPlanId: sub?.plan_id ?? null,
      nextBillingAt: nextBillingAt ?? null,
      billingPeriodStart: sub?.current_start
        ? new Date(sub.current_start * 1000)
        : null,
      subscriptionAutoRenew: subscriptionAutoRenewFromEntity(sub),
    })
    .where(eq(users.id, userId));
}

export async function downgradeUserAfterSubscriptionEnd(
  userId: string
): Promise<void> {
  await getDb()
    .update(users)
    .set({
      plan: "free",
      planStatus: "free",
      razorpaySubscriptionId: null,
      razorpayPlanId: null,
      nextBillingAt: null,
      billingPeriodStart: null,
      subscriptionAutoRenew: true,
    })
    .where(eq(users.id, userId));
}

export async function syncUserProfessionalSubscriptionFromRazorpay(
  userId: string,
  subscriptionId: string,
  options?: { planStatus?: string }
): Promise<void> {
  const sub = await fetchRazorpaySubscription(subscriptionId);
  const planExpiresAt =
    planExpiresAtFromSubscription(sub) ??
    new Date(Date.now() + RAZORPAY_PLAN_DAYS * 24 * 60 * 60 * 1000);
  const nextBillingAt = nextBillingAtFromSubscription(sub);
  await getDb()
    .update(users)
    .set({
      proPlanStatus: options?.planStatus ?? "active",
      proPlanExpiresAt: planExpiresAt,
      proRazorpaySubscriptionId: subscriptionId,
      proRazorpayPlanId: sub?.plan_id ?? null,
      proNextBillingAt: nextBillingAt ?? null,
      proBillingPeriodStart: sub?.current_start
        ? new Date(sub.current_start * 1000)
        : null,
      proSubscriptionAutoRenew: subscriptionAutoRenewFromEntity(sub),
    })
    .where(eq(users.id, userId));
}

export async function downgradeProfessionalAfterSubscriptionEnd(
  userId: string
): Promise<void> {
  await getDb()
    .update(users)
    .set({
      proPlanStatus: "free",
      proPlanExpiresAt: null,
      proRazorpaySubscriptionId: null,
      proRazorpayPlanId: null,
      proNextBillingAt: null,
      proBillingPeriodStart: null,
      proSubscriptionAutoRenew: true,
    })
    .where(eq(users.id, userId));
}

export async function syncUserTempInboxSubscriptionFromRazorpay(
  userId: string,
  subscriptionId: string,
  options?: { planStatus?: string }
): Promise<void> {
  const sub = await fetchRazorpaySubscription(subscriptionId);
  const planExpiresAt =
    planExpiresAtFromSubscription(sub) ??
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const nextBillingAt = nextBillingAtFromSubscription(sub);
  await getDb()
    .update(users)
    .set({
      tempInboxPlanStatus: options?.planStatus ?? "active",
      tempInboxPlanExpiresAt: planExpiresAt,
      tempRazorpaySubscriptionId: subscriptionId,
      tempRazorpayPlanId: sub?.plan_id ?? null,
      tempNextBillingAt: nextBillingAt ?? null,
      tempSubscriptionAutoRenew: subscriptionAutoRenewFromEntity(sub),
    })
    .where(eq(users.id, userId));
}

export async function downgradeTempInboxAfterSubscriptionEnd(
  userId: string
): Promise<void> {
  await getDb()
    .update(users)
    .set({
      tempInboxPlanStatus: "free",
      tempInboxPlanExpiresAt: null,
      tempRazorpaySubscriptionId: null,
      tempRazorpayPlanId: null,
      tempNextBillingAt: null,
      tempSubscriptionAutoRenew: true,
    })
    .where(eq(users.id, userId));
}
