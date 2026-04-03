import { shouldShowGoldenTick } from "@/lib/plan";
import type { users } from "@/db/schema";

/** @deprecated use shouldShowGoldenTick from @/lib/plan */
export function computeGoldenTickEligible(
  user: Pick<
    typeof users.$inferSelect,
    "id" | "plan" | "planExpiresAt" | "planStatus"
  >
): boolean {
  return shouldShowGoldenTick(user);
}
