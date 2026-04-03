import { AdminDomainDetailPage } from "@/components/admin/admin-domain-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminDomainDetailPage domainId={id} />;
}
