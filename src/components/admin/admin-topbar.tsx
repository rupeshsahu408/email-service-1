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
  if (pathname === "/admin/settings") return "Settings";
  return "Admin";
}

export function AdminTopbar({ email }: Props) {
  const pathname = usePathname() ?? "";
  const title = titleForPath(pathname);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)]/90 px-4 py-3 shadow-[0_1px_0_rgba(28,27,51,0.06)] backdrop-blur-md dark:shadow-[0_1px_0_rgba(255,255,255,0.06)] md:px-6 md:py-3.5">
      <div className="min-w-0 pr-2">
        <h1 className="text-base font-semibold tracking-tight text-[var(--foreground)] md:text-lg">
          {title}
        </h1>
        <p className="text-xs font-medium text-[var(--muted)]">
          Secure admin workspace
        </p>
      </div>
      <AdminProfileMenu email={email} />
    </header>
  );
}
