import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { hasTemporaryInboxPlan } from "@/lib/plan";
import { TempInboxClient } from "@/components/temp-inbox-client";

export const dynamic = "force-dynamic";

export default async function TempInboxPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const active = hasTemporaryInboxPlan({
    tempInboxPlanStatus: user.tempInboxPlanStatus,
    tempInboxPlanExpiresAt: user.tempInboxPlanExpiresAt,
  });

  if (!active) {
    redirect("/temp-inbox/upgrade");
  }

  return <TempInboxClient />;
}

