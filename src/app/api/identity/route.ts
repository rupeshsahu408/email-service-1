import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { getEffectivePlan, shouldShowGoldenTick } from "@/lib/plan";
import { getCurrentUser } from "@/lib/session";
import {
  getStorageThresholdState,
  getUserStorageSnapshot,
} from "@/lib/storage-quota";

/** Sidebar / shell: plan + golden tick + storage threshold (for inbox warnings). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const plan = getEffectivePlan(user);
  const goldenTickEligible = shouldShowGoldenTick(user);

  const storageSnap = await getUserStorageSnapshot(getDb(), user);
  const storage = getStorageThresholdState(storageSnap);

  return NextResponse.json({
    plan,
    goldenTickEligible,
    storage: {
      usageLevel: storage.level,
      usageRatio: storage.usageRatio,
      message: storage.message,
    },
  });
}
