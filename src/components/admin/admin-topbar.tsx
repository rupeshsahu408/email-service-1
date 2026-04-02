"use client";

import { usePathname } from "next/navigation";
import { AdminProfileMenu } from "./admin-profile-menu";

type Props = {
  email: string;
};

function titleForPath(pathname: string): string {
  if (pathname === "/admin/dashboard") return "Dashboard";
  if (pathname === "/admin/users") return "Users";
  if (pathname.startsWith("/admin/users/")) return "User details";
  if (pathname === "/admin/domains") return "Domains";
  if (pathname.startsWith("/admin/domains/")) return "Domain details";
  if (pathname === "/admin/security") return "Security";
  return "Admin";
}

export function AdminTopbar({ email }: Props) {
  const pathname = usePathname() ?? "";
  const title = titleForPath(pathname);

  return (
    <header className="flex items-center justify-between border-b border-[#ece9fb] bg-white px-4 py-3 md:px-6">
      <div>
        <h1 className="text-base font-semibold text-[#1c1b33] md:text-lg">{title}</h1>
        <p className="text-xs text-[#777394]">Secure admin workspace</p>
      </div>
      <AdminProfileMenu email={email} />
    </header>
  );
}
