import { redirect } from "next/navigation";
import { formatUserEmail } from "@/lib/constants";
import { getCurrentUser } from "@/lib/session";
import { AnalyticsClient } from "@/components/analytics-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Analytics — Sendora",
};

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <AnalyticsClient email={formatUserEmail(user.localPart)} />
  );
}
