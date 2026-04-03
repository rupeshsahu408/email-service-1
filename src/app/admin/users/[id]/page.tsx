import { AdminUserDetailPage } from "@/components/admin/admin-user-detail-page";

export default async function AdminUserDetailRoutePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminUserDetailPage userId={id} />;
}
