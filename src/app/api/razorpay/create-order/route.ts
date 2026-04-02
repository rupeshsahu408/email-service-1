import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  RAZORPAY_PLAN_AMOUNT,
  RAZORPAY_PLAN_CURRENCY,
} from "@/lib/razorpay";
import { logError } from "@/lib/logger";

export async function POST() {
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
    const order = await createRazorpayOrder({
      amount: RAZORPAY_PLAN_AMOUNT,
      currency: RAZORPAY_PLAN_CURRENCY,
      receipt: `user_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: { userId: user.id, localPart: user.localPart },
    });
    return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (e) {
    logError("razorpay_create_order_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json({ error: "Could not create order." }, { status: 502 });
  }
}
