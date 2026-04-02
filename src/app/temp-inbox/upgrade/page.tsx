import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { hasTemporaryInboxPlan } from "@/lib/plan";
import { TempInboxUpgradePage } from "@/components/temp-inbox-upgrade-page";
import { formatUserEmail } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function TempInboxUpgradePageRoute() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const active = hasTemporaryInboxPlan({
    tempInboxPlanStatus: user.tempInboxPlanStatus,
    tempInboxPlanExpiresAt: user.tempInboxPlanExpiresAt,
  });

  if (active) {
    redirect("/temp-inbox");
  }

  return (
    <TempInboxUpgradePage
      email={formatUserEmail(user.localPart)}
      razorpayKeyId={process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? ""}
    />
  );
}

