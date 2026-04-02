import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { formatUserEmail } from "@/lib/constants";
import { UpgradePage } from "@/components/upgrade-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Upgrade Plans — Sendora",
};

export default async function UpgradePageRoute() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const now = new Date();
  const isBusiness =
    user.plan === "business" &&
    (!user.planExpiresAt || user.planExpiresAt > now);

  return (
    <UpgradePage
      email={formatUserEmail(user.localPart)}
      plan={isBusiness ? "business" : "free"}
      planExpiresAt={user.planExpiresAt?.toISOString() ?? null}
      professionalActive={false}
      professionalExpiresAt={null}
      razorpayKeyId={process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? ""}
    />
  );
}
