import { redirect } from "next/navigation";
import { formatUserEmail } from "@/lib/constants";
import { getCurrentUser } from "@/lib/session";
import { SettingsClient } from "@/components/settings-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings — Sendora",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const sp = await searchParams;
  const initialSection =
    sp.section === "business" || sp.section === "professional"
      ? sp.section
      : undefined;
  return (
    <SettingsClient
      email={formatUserEmail(user.localPart)}
      initialSection={initialSection}
    />
  );
}
