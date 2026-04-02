import { createHmac } from "crypto";

export const RAZORPAY_PLAN_AMOUNT = parseInt(
  process.env.RAZORPAY_PLAN_AMOUNT ?? "19900",
  10
);
export const RAZORPAY_PLAN_CURRENCY = process.env.RAZORPAY_PLAN_CURRENCY ?? "INR";
export const RAZORPAY_PLAN_DAYS = 30;
export const RAZORPAY_BUSINESS_PLAN_ID =
  process.env.RAZORPAY_BUSINESS_PLAN_ID?.trim() ||
  process.env.RAZORPAY_PLAN_ID?.trim() ||
  "plan_SX7vDxnLye49w6";
export const RAZORPAY_PRO_PLAN_ID =
  process.env.RAZORPAY_PRO_PLAN_ID?.trim() || "";

export const RAZORPAY_TEMP_INBOX_PLAN_ID =
  process.env.RAZORPAY_TEMP_INBOX_PLAN_ID?.trim() || "";

function getCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set");
  }
  return { keyId, keySecret };
}

function authHeader() {
  const { keyId, keySecret } = getCredentials();
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

export async function createRazorpayOrder(params: {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string }> {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes ?? {},
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Razorpay create order failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function createRazorpaySubscription(params: {
  planId: string;
  totalCount?: number;
  notes?: Record<string, string>;
}): Promise<{ id: string; short_url: string }> {
  const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      plan_id: params.planId,
      total_count: params.totalCount ?? 120,
      quantity: 1,
      notes: params.notes ?? {},
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Razorpay create subscription failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function cancelRazorpaySubscription(
  subscriptionId: string,
  cancelAtCycleEnd = true
): Promise<void> {
  const res = await fetch(
    `https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(),
      },
      body: JSON.stringify({ cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Razorpay cancel subscription failed: ${res.status} ${text}`);
  }
}

export function verifyRazorpayPayment(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const { keySecret } = getCredentials();
  const body = `${params.orderId}|${params.paymentId}`;
  const expected = createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");
  return expected === params.signature;
}

export function verifyRazorpaySubscriptionPayment(params: {
  subscriptionId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const { keySecret } = getCredentials();
  const body = `${params.paymentId}|${params.subscriptionId}`;
  const expected = createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");
  return expected === params.signature;
}

export function verifyRazorpayWebhook(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return expected === signature;
}

export function isRazorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() &&
    process.env.RAZORPAY_KEY_SECRET?.trim()
  );
}

export function isBusinessPlanId(planId: string | undefined | null): boolean {
  if (!planId) return false;
  return planId === RAZORPAY_BUSINESS_PLAN_ID;
}

export function isProfessionalPlanId(planId: string | undefined | null): boolean {
  if (!planId || !RAZORPAY_PRO_PLAN_ID) return false;
  return planId === RAZORPAY_PRO_PLAN_ID;
}

export function isTempInboxPlanId(planId: string | undefined | null): boolean {
  if (!planId || !RAZORPAY_TEMP_INBOX_PLAN_ID) return false;
  return planId === RAZORPAY_TEMP_INBOX_PLAN_ID;
}

/** Razorpay subscription entity (subset). */
export type RazorpaySubscriptionEntity = {
  id: string;
  plan_id?: string;
  status?: string;
  current_start?: number;
  current_end?: number;
  charge_at?: number;
  end_at?: number;
  paid_count?: number;
  notes?: Record<string, string>;
};

/** Detect Professional subscriptions by Razorpay plan id or subscription notes from our API. */
export function isProfessionalSubscriptionEntity(
  sub: RazorpaySubscriptionEntity | null | undefined
): boolean {
  if (!sub) return false;
  if (isProfessionalPlanId(sub.plan_id)) return true;
  return sub.notes?.kind === "professional";
}

/** Detect Temporary Inbox subscriptions by Razorpay plan id or notes.kind from our API. */
export function isTempInboxSubscriptionEntity(
  sub: RazorpaySubscriptionEntity | null | undefined
): boolean {
  if (!sub) return false;
  if (isTempInboxPlanId(sub.plan_id)) return true;
  return sub.notes?.kind === "temp_inbox";
}

export async function fetchRazorpaySubscription(
  subscriptionId: string
): Promise<RazorpaySubscriptionEntity | null> {
  try {
    const res = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${subscriptionId}`,
      {
        headers: {
          Authorization: authHeader(),
        },
      }
    );
    if (!res.ok) return null;
    return (await res.json()) as RazorpaySubscriptionEntity;
  } catch {
    return null;
  }
}

export function planExpiresAtFromSubscription(
  sub: RazorpaySubscriptionEntity | null
): Date | undefined {
  if (!sub?.current_end || typeof sub.current_end !== "number") return undefined;
  return new Date(sub.current_end * 1000);
}

export function nextBillingAtFromSubscription(
  sub: RazorpaySubscriptionEntity | null
): Date | undefined {
  if (!sub) return undefined;
  const ts = sub.charge_at ?? sub.current_end;
  if (!ts || typeof ts !== "number") return undefined;
  return new Date(ts * 1000);
}

export function subscriptionAutoRenewFromEntity(
  sub: RazorpaySubscriptionEntity | null
): boolean {
  if (!sub?.status) return true;
  if (sub.status === "cancelled" || sub.status === "completed") return false;
  return true;
}
