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

  const dbUser = await getDb()
    .select({
      proRazorpaySubscriptionId: users.proRazorpaySubscriptionId,
      proPlanStatus: users.proPlanStatus,
    })
    .from(users)
    .where(eq(users.id, user!.id))
    .then((rows) => rows[0]);

  if (!dbUser || dbUser.proPlanStatus === "free") {
    return NextResponse.json(
      { error: "No active Professional plan found." },
      { status: 400 }
    );
  }
  if (dbUser.proPlanStatus === "cancelled") {
    return NextResponse.json(
      { error: "Professional subscription is already cancelled." },
      { status: 400 }
    );
  }
  const subscriptionId = dbUser.proRazorpaySubscriptionId!;
  if (!subscriptionId) {
    return NextResponse.json(
      { error: "No Professional subscription ID on record." },
      { status: 400 }
    );
  }

  try {
    await cancelRazorpaySubscription(subscriptionId, true);
    await getDb()
      .update(users)
      .set({ proPlanStatus: "cancelled", proSubscriptionAutoRenew: false })
      .where(eq(users.id, user!.id));
    logInfo("razorpay_pro_subscription_cancelled", {
      userId: user!.id,
      subscriptionId,
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    logError("razorpay_cancel_pro_subscription_failed", {
      message: e instanceof Error ? (e as Error).message : "unknown",
      userId: user!.id,
      subscriptionId,
    });
    return NextResponse.json(
      { error: "Could not cancel Professional subscription. Please try again." },
      { status: 502 }
    );
  }
}
