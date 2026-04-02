import type { users } from "@/db/schema";

export type EffectivePlan = "free" | "business";
export type ProfessionalPlanStatus = "free" | "active" | "cancelled" | "past_due";

/**
 * Business access: paid plan not past expiry. Cancelled-at-cycle-end stays business until planExpiresAt.
 */
export function getEffectivePlan(
  user: Pick<
    typeof users.$inferSelect,
    "plan" | "planExpiresAt" | "planStatus"
  >
): EffectivePlan {
  const now = new Date();
  if (user.plan !== "business") return "free";
  if (user.planExpiresAt && user.planExpiresAt <= now) return "free";
  return "business";
}

export function isBusinessPlan(
  user: Pick<
    typeof users.$inferSelect,
    "plan" | "planExpiresAt" | "planStatus"
  >
): boolean {
  return getEffectivePlan(user) === "business";
}

/**
 * Golden verified tick (Sendora UI only): business subscription in good standing.
 * Excludes past_due; includes cancelled until planExpiresAt (handled by getEffectivePlan).
 */
export function shouldShowGoldenTick(
  user: Pick<
    typeof users.$inferSelect,
    "plan" | "planExpiresAt" | "planStatus"
  >
): boolean {
  if (getEffectivePlan(user) !== "business") return false;
  const s = user.planStatus;
  if (s === "past_due") return false;
  if (s === "free") return false;
  return true;
}

export type BusinessGateError = {
  error: string;
  code: "FORBIDDEN" | "UNAUTHORIZED";
  status: 401 | 403;
};

export function requireBusinessPlan(
  user: Pick<
    typeof users.$inferSelect,
    "plan" | "planExpiresAt" | "planStatus"
  > | null
): true | BusinessGateError {
  if (!user) {
    return { error: "Unauthorized", code: "UNAUTHORIZED", status: 401 };
  }
  if (!isBusinessPlan(user)) {
    return {
      error: "Business plan required",
      code: "FORBIDDEN",
      status: 403,
    };
  }
  return true;
}

export function hasProfessionalPlan(
  user: Pick<
    typeof users.$inferSelect,
    "proPlanStatus" | "proPlanExpiresAt"
  >
): boolean {
  const now = new Date();
  const status = user.proPlanStatus;
  if (status !== "active" && status !== "cancelled") return false;
  if (user.proPlanExpiresAt && user.proPlanExpiresAt <= now) return false;
  return true;
}

export type TemporaryInboxPlanStatus =
  | "free"
  | "active"
  | "cancelled"
  | "past_due";

export function hasTemporaryInboxPlan(
  user: Pick<
    typeof users.$inferSelect,
    "tempInboxPlanStatus" | "tempInboxPlanExpiresAt"
  >
): boolean {
  const now = new Date();
  const status = user.tempInboxPlanStatus;
  if (status !== "active" && status !== "cancelled") return false;
  if (user.tempInboxPlanExpiresAt && user.tempInboxPlanExpiresAt <= now)
    return false;
  return true;
}

export type TemporaryInboxGateError = {
  error: string;
  code: "FORBIDDEN" | "UNAUTHORIZED";
  status: 401 | 403;
};

export function requireTemporaryInboxPlan(
  user: Pick<
    typeof users.$inferSelect,
    "tempInboxPlanStatus" | "tempInboxPlanExpiresAt"
  > | null
): true | TemporaryInboxGateError {
  if (!user) {
    return { error: "Unauthorized", code: "UNAUTHORIZED", status: 401 };
  }
  if (!hasTemporaryInboxPlan(user)) {
    return {
      error: "Temporary Inbox plan required",
      code: "FORBIDDEN",
      status: 403,
    };
  }
  return true;
}

export function getProfessionalStatus(
  user: Pick<
    typeof users.$inferSelect,
    "proPlanStatus" | "proPlanExpiresAt"
  >
): ProfessionalPlanStatus {
  if (!user.proPlanStatus || user.proPlanStatus === "free") return "free";
  if (user.proPlanStatus === "past_due") return "past_due";
  const now = new Date();
  if (user.proPlanExpiresAt && user.proPlanExpiresAt <= now) return "free";
  return user.proPlanStatus as ProfessionalPlanStatus;
}
