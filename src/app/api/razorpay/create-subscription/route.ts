import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  createRazorpaySubscription,
  isRazorpayConfigured,
} from "@/lib/razorpay";
import { getRazorpayPlanMapping, upsertBillingSubscription } from "@/lib/billing";
import { logError } from "@/lib/logger";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { error: "Payment is not configured on this server." },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { interval?: "monthly" | "yearly" };
    const mapping = getRazorpayPlanMapping({
      productType: "business_email",
      interval: body.interval,
    });
    if (!mapping.planId) {
      return NextResponse.json(
        { error: "Business plan is not configured on this server." },
        { status: 503 }
      );
    }
    const subscription = await createRazorpaySubscription({
      planId: mapping.planId,
      totalCount: mapping.totalCount,
      notes: {
        userId: user.id,
        localPart: user.localPart,
        kind: "business",
        productType: mapping.productType,
        interval: mapping.interval,
      },
    });
    await upsertBillingSubscription({
      userId: user.id,
      productType: mapping.productType,
      interval: mapping.interval,
      providerSubscriptionId: subscription.id,
      providerPlanId: mapping.planId,
      status: "created",
      autoRenew: true,
      metadata: { source: "create-subscription" },
    });
    return NextResponse.json({ subscriptionId: subscription.id });
  } catch (e) {
    logError("razorpay_create_subscription_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json(
      { error: "Could not create subscription." },
      { status: 502 }
    );
  }
}
