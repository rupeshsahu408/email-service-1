import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import {
  verifyRazorpayPayment,
  verifyRazorpaySubscriptionPayment,
  RAZORPAY_PLAN_DAYS,
  fetchRazorpaySubscription,
  isTempInboxSubscriptionEntity,
  isProfessionalSubscriptionEntity,
} from "@/lib/razorpay";
import {
  syncUserTempInboxSubscriptionFromRazorpay,
  syncUserProfessionalSubscriptionFromRazorpay,
  syncUserSubscriptionFromRazorpay,
} from "@/lib/razorpay-subscription-sync";
import { logError, logInfo } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    razorpay_order_id,
    razorpay_subscription_id,
    razorpay_payment_id,
    razorpay_signature,
  } = body as Record<string, string>;

  if (!razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing payment fields" }, { status: 400 });
  }

  let valid = false;
  const isSubscription = Boolean(razorpay_subscription_id);

  if (isSubscription) {
    valid = verifyRazorpaySubscriptionPayment({
      subscriptionId: razorpay_subscription_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
  } else if (razorpay_order_id) {
    valid = verifyRazorpayPayment({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
  } else {
    return NextResponse.json({ error: "Missing order or subscription id" }, { status: 400 });
  }

  if (!valid) {
    logError("razorpay_verify_invalid_signature", { userId: user.id });
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  const planExpiresAt = new Date(Date.now() + RAZORPAY_PLAN_DAYS * 24 * 60 * 60 * 1000);

  try {
    if (isSubscription && razorpay_subscription_id) {
      const sub = await fetchRazorpaySubscription(razorpay_subscription_id);
      if (isTempInboxSubscriptionEntity(sub)) {
        await syncUserTempInboxSubscriptionFromRazorpay(
          user.id,
          razorpay_subscription_id
        );
      } else if (isProfessionalSubscriptionEntity(sub)) {
        await syncUserProfessionalSubscriptionFromRazorpay(
          user.id,
          razorpay_subscription_id
        );
      } else {
        await syncUserSubscriptionFromRazorpay(user.id, razorpay_subscription_id);
      }
      await getDb()
        .update(users)
        .set({ razorpayOrderId: null })
        .where(eq(users.id, user.id));
    } else {
      await getDb()
        .update(users)
        .set({
          plan: "business",
          planStatus: "active",
          planExpiresAt,
          razorpayOrderId: razorpay_order_id ?? null,
          razorpaySubscriptionId: null,
        })
        .where(eq(users.id, user.id));
    }

    const row = await getDb()
      .select({ planExpiresAt: users.planExpiresAt })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    const exp = row[0]?.planExpiresAt ?? planExpiresAt;

    logInfo("razorpay_plan_upgraded", {
      userId: user.id,
      planExpiresAt: exp.toISOString(),
      mode: isSubscription ? "subscription" : "order",
    });
    return NextResponse.json({ ok: true, planExpiresAt: exp });
  } catch (e) {
    logError("razorpay_upgrade_db_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json({ error: "Could not upgrade account." }, { status: 500 });
  }
}
