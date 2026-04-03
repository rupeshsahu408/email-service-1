import { redirect } from "next/navigation";
import { formatUserEmail } from "@/lib/constants";
import { getCurrentUser } from "@/lib/session";
import { InboxClient } from "@/components/inbox-client";
import { hasTemporaryInboxPlan } from "@/lib/plan";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inbox — Sendora",
};

export default async function InboxPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const now = new Date();
  const isBusiness =
    user.plan === "business" &&
    (!user.planExpiresAt || user.planExpiresAt > now);
  const tempInboxActive = hasTemporaryInboxPlan({
    tempInboxPlanStatus: user.tempInboxPlanStatus,
    tempInboxPlanExpiresAt: user.tempInboxPlanExpiresAt,
  });

  return (
    <InboxClient
      email={formatUserEmail(user.localPart)}
      avatarUrl={user.avatarUrl ?? null}
      plan={isBusiness ? "business" : "free"}
      planExpiresAt={user.planExpiresAt?.toISOString() ?? null}
      professionalActive={false}
      professionalExpiresAt={null}
      tempInboxActive={tempInboxActive}
    />
  );
}
