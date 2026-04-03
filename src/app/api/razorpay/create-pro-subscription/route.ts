import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  createRazorpaySubscription,
  isRazorpayConfigured,
  RAZORPAY_PRO_PLAN_ID,
} from "@/lib/razorpay";
import { logError } from "@/lib/logger";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Professional plan is intentionally disabled.
  return NextResponse.json(
    { error: "Professional plan is coming soon and is currently disabled." },
    { status: 503 }
  );

  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { error: "Payment is not configured on this server." },
      { status: 503 }
    );
  }
  if (!RAZORPAY_PRO_PLAN_ID) {
    return NextResponse.json(
      { error: "Professional plan is not configured on this server." },
      { status: 503 }
    );
  }

  try {
    const subscription = await createRazorpaySubscription({
      planId: RAZORPAY_PRO_PLAN_ID,
      totalCount: 120,
      notes: {
        userId: user!.id,
        localPart: user!.localPart,
        kind: "professional",
      },
    });
    return NextResponse.json({ subscriptionId: subscription.id });
  } catch (e: unknown) {
    logError("razorpay_create_pro_subscription_failed", {
      message: e instanceof Error ? (e as Error).message : "unknown",
    });
    return NextResponse.json(
      { error: "Could not create subscription." },
      { status: 502 }
    );
  }
}
