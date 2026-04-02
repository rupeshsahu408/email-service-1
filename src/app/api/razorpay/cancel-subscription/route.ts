import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { cancelRazorpaySubscription, isRazorpayConfigured } from "@/lib/razorpay";
import { logError, logInfo } from "@/lib/logger";

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

  const dbUser = await getDb()
    .select({
      razorpaySubscriptionId: users.razorpaySubscriptionId,
      plan: users.plan,
      planStatus: users.planStatus,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .then((rows) => rows[0]);

  if (!dbUser || dbUser.plan !== "business") {
    return NextResponse.json(
      { error: "No active Business plan found." },
      { status: 400 }
    );
  }

  if (dbUser.planStatus === "cancelled") {
    return NextResponse.json(
      { error: "Subscription is already cancelled." },
      { status: 400 }
    );
  }

  const subscriptionId = dbUser.razorpaySubscriptionId;
  if (!subscriptionId) {
    return NextResponse.json(
      { error: "No subscription ID on record. Please contact support." },
      { status: 400 }
    );
  }

  try {
    await cancelRazorpaySubscription(subscriptionId, true);
  } catch (e) {
    logError("razorpay_cancel_subscription_failed", {
      message: e instanceof Error ? e.message : "unknown",
      userId: user.id,
      subscriptionId,
    });
    return NextResponse.json(
      { error: "Could not cancel subscription. Please try again." },
      { status: 502 }
    );
  }

  try {
    await getDb()
      .update(users)
      .set({ planStatus: "cancelled", subscriptionAutoRenew: false })
      .where(eq(users.id, user.id));
    logInfo("razorpay_subscription_cancelled", { userId: user.id, subscriptionId });
  } catch (e) {
    logError("razorpay_cancel_db_failed", {
      message: e instanceof Error ? e.message : "unknown",
      userId: user.id,
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
