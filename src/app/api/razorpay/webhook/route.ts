import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import {
  verifyRazorpayWebhook,
  RAZORPAY_PLAN_DAYS,
  fetchRazorpaySubscription,
  isTempInboxSubscriptionEntity,
  isProfessionalSubscriptionEntity,
  nextBillingAtFromSubscription,
  planExpiresAtFromSubscription,
} from "@/lib/razorpay";
import {
  downgradeTempInboxAfterSubscriptionEnd,
  downgradeProfessionalAfterSubscriptionEnd,
  downgradeUserAfterSubscriptionEnd,
  syncUserTempInboxSubscriptionFromRazorpay,
  syncUserProfessionalSubscriptionFromRazorpay,
  syncUserSubscriptionFromRazorpay,
} from "@/lib/razorpay-subscription-sync";
import { logError, logInfo, logWarn } from "@/lib/logger";

export const runtime = "nodejs";

type RazorpayEntity = Record<string, unknown>;

function extractSubscriptionNotes(payload: Record<string, unknown>): {
  userId?: string;
  subscriptionId?: string;
} {
  const sub = (payload?.subscription as { entity?: RazorpayEntity })?.entity;
  const notes = (sub?.notes ?? {}) as Record<string, string>;
  return {
    userId: notes.userId,
    subscriptionId: typeof sub?.id === "string" ? sub.id : undefined,
  };
}

function extractPaymentNotes(payload: Record<string, unknown>): {
  userId?: string;
  subscriptionId?: string;
} {
  const payment = (payload?.payment as { entity?: RazorpayEntity })?.entity;
  const notes = (payment?.notes ?? {}) as Record<string, string>;
  const subscriptionId =
    typeof payment?.subscription_id === "string"
      ? payment.subscription_id
      : undefined;
  return { userId: notes.userId, subscriptionId };
}

export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyRazorpayWebhook(rawBody, signature)) {
    logWarn("razorpay_webhook_invalid_signature");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let event: { event: string; payload?: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = event.payload ?? {};
  logInfo("razorpay_webhook_event", { type: event.event });

  switch (event.event) {
    case "subscription.activated": {
      const { userId, subscriptionId } = extractSubscriptionNotes(payload);
      if (!userId) {
        logWarn("razorpay_webhook_no_user_id", { event: event.event });
        break;
      }
      if (!subscriptionId) {
        logWarn("razorpay_webhook_no_subscription_id", { event: event.event });
        break;
      }
      try {
        const sub = await fetchRazorpaySubscription(subscriptionId);
        if (isTempInboxSubscriptionEntity(sub)) {
          await syncUserTempInboxSubscriptionFromRazorpay(userId, subscriptionId);
        } else if (isProfessionalSubscriptionEntity(sub)) {
          await syncUserProfessionalSubscriptionFromRazorpay(
            userId,
            subscriptionId
          );
        } else {
          await syncUserSubscriptionFromRazorpay(userId, subscriptionId);
        }
        logInfo("razorpay_webhook_subscription_activated", { userId });
      } catch (e) {
        logError("razorpay_webhook_activated_failed", {
          message: e instanceof Error ? e.message : "unknown",
          userId,
        });
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }
      break;
    }

    case "subscription.charged": {
      const { userId, subscriptionId } = extractPaymentNotes(payload);
      if (!userId) {
        logWarn("razorpay_webhook_no_user_id", { event: event.event });
        break;
      }
      try {
        if (subscriptionId) {
          const sub = await fetchRazorpaySubscription(subscriptionId);
          if (isTempInboxSubscriptionEntity(sub)) {
            await syncUserTempInboxSubscriptionFromRazorpay(
              userId,
              subscriptionId
            );
          } else if (isProfessionalSubscriptionEntity(sub)) {
            await syncUserProfessionalSubscriptionFromRazorpay(
              userId,
              subscriptionId
            );
          } else {
            await syncUserSubscriptionFromRazorpay(userId, subscriptionId);
          }
        } else {
          const planExpiresAt = new Date(
            Date.now() + RAZORPAY_PLAN_DAYS * 24 * 60 * 60 * 1000
          );
          await getDb()
            .update(users)
            .set({
              plan: "business",
              planStatus: "active",
              planExpiresAt,
            })
            .where(eq(users.id, userId));
        }
        logInfo("razorpay_webhook_subscription_charged", { userId });
      } catch (e) {
        logError("razorpay_webhook_charged_failed", {
          message: e instanceof Error ? e.message : "unknown",
          userId,
        });
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }
      break;
    }

    case "payment.failed": {
      const { userId, subscriptionId } = extractPaymentNotes(payload);
      if (!userId) {
        logWarn("razorpay_webhook_no_user_id", { event: event.event });
        break;
      }
      try {
        const sub = subscriptionId
          ? await fetchRazorpaySubscription(subscriptionId)
          : null;
        const isTemp = isTempInboxSubscriptionEntity(sub);
        const isPro = isProfessionalSubscriptionEntity(sub);
        await getDb()
          .update(users)
          .set(
            isTemp
              ? { tempInboxPlanStatus: "past_due" }
              : isPro
              ? { proPlanStatus: "past_due" }
              : { planStatus: "past_due" }
          )
          .where(eq(users.id, userId));
        logInfo("razorpay_webhook_payment_failed", { userId });
      } catch (e) {
        logError("razorpay_webhook_payment_failed_db", {
          message: e instanceof Error ? e.message : "unknown",
          userId,
        });
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }
      break;
    }

    case "subscription.cancelled": {
      const subNotes = extractSubscriptionNotes(payload);
      let subscriptionId = subNotes.subscriptionId;
      const userId = subNotes.userId;
      if (!subscriptionId) {
        const ent = (payload?.subscription as { entity?: RazorpayEntity })?.entity;
        if (typeof ent?.id === "string") subscriptionId = ent.id;
      }
      if (!userId) {
        logWarn("razorpay_webhook_no_user_id", { event: event.event });
        break;
      }
      try {
        const sub = subscriptionId
          ? await fetchRazorpaySubscription(subscriptionId)
          : null;
        const isTemp = isTempInboxSubscriptionEntity(sub);
        const isPro = isProfessionalSubscriptionEntity(sub);
        const planExpiresAt =
          planExpiresAtFromSubscription(sub) ??
          new Date(Date.now() + RAZORPAY_PLAN_DAYS * 24 * 60 * 60 * 1000);
        const nextBillingAt = nextBillingAtFromSubscription(sub);
        await getDb()
          .update(users)
          .set(
            isTemp
              ? {
                  tempInboxPlanStatus: "cancelled",
                  tempSubscriptionAutoRenew: false,
                  tempInboxPlanExpiresAt: planExpiresAt,
                  tempNextBillingAt: nextBillingAt ?? null,
                }
              : isPro
              ? {
                  proPlanStatus: "cancelled",
                  proSubscriptionAutoRenew: false,
                  proPlanExpiresAt: planExpiresAt,
                  proNextBillingAt: nextBillingAt ?? null,
                }
              : {
                  planStatus: "cancelled",
                  subscriptionAutoRenew: false,
                  planExpiresAt,
                  nextBillingAt: nextBillingAt ?? null,
                }
          )
          .where(eq(users.id, userId));
        logInfo("razorpay_webhook_subscription_cancelled", { userId });
      } catch (e) {
        logError("razorpay_webhook_cancelled_failed", {
          message: e instanceof Error ? e.message : "unknown",
          userId,
        });
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }
      break;
    }

    case "subscription.halted": {
      const { userId, subscriptionId } = extractSubscriptionNotes(payload);
      if (!userId) {
        logWarn("razorpay_webhook_no_user_id", { event: event.event });
        break;
      }
      try {
        const sub = subscriptionId
          ? await fetchRazorpaySubscription(subscriptionId)
          : null;
        if (isTempInboxSubscriptionEntity(sub)) {
          await downgradeTempInboxAfterSubscriptionEnd(userId);
        } else if (isProfessionalSubscriptionEntity(sub)) {
          await downgradeProfessionalAfterSubscriptionEnd(userId);
        } else {
          await downgradeUserAfterSubscriptionEnd(userId);
        }
        logInfo("razorpay_webhook_subscription_halted_downgraded", { userId });
      } catch (e) {
        logError("razorpay_webhook_halted_failed", {
          message: e instanceof Error ? e.message : "unknown",
          userId,
        });
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }
      break;
    }

    case "payment.captured": {
      const { userId, subscriptionId } = extractPaymentNotes(payload);
      if (!userId) break;
      try {
        if (subscriptionId) {
          const sub = await fetchRazorpaySubscription(subscriptionId);
          if (isTempInboxSubscriptionEntity(sub)) {
            await syncUserTempInboxSubscriptionFromRazorpay(
              userId,
              subscriptionId
            );
          } else if (isProfessionalSubscriptionEntity(sub)) {
            await syncUserProfessionalSubscriptionFromRazorpay(
              userId,
              subscriptionId
            );
          } else {
            await syncUserSubscriptionFromRazorpay(userId, subscriptionId);
          }
        } else {
          const planExpiresAt = new Date(
            Date.now() + RAZORPAY_PLAN_DAYS * 24 * 60 * 60 * 1000
          );
          await getDb()
            .update(users)
            .set({ plan: "business", planStatus: "active", planExpiresAt })
            .where(eq(users.id, userId));
        }
        logInfo("razorpay_webhook_plan_upgraded_captured", { userId });
      } catch (e) {
        logError("razorpay_webhook_captured_failed", {
          message: e instanceof Error ? e.message : "unknown",
          userId,
        });
        return NextResponse.json({ error: "Server error" }, { status: 500 });
      }
      break;
    }

    default:
      logInfo("razorpay_webhook_unhandled", { event: event.event });
  }

  return NextResponse.json({ ok: true });
}
