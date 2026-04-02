"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function linkClass(active: boolean) {
  return active
    ? "block rounded-lg bg-[#f1ecff] px-3 py-2 text-sm font-semibold text-[#452dc9]"
    : "block rounded-lg px-3 py-2 text-sm font-medium text-[#2f2a4c] hover:bg-[#f4f2fb]";
}

export function AdminSidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="w-full border-b border-[#ece9fb] bg-white p-4 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="mb-6 flex items-center gap-2">
        <img src="/sendora-logo.png" alt="Sendora" className="h-8 w-8 object-contain" />
        <div>
          <p className="text-sm font-bold text-[#1c1b33]">Sendora Admin</p>
          <p className="text-xs text-[#5d587a]">Operations</p>
        </div>
      </div>
      <nav className="space-y-1">
        <Link href="/admin/dashboard" className={linkClass(pathname === "/admin/dashboard")}>
          Dashboard
        </Link>
        <Link href="/admin/users" className={linkClass(pathname === "/admin/users" || pathname.startsWith("/admin/users/"))}>
          Users
        </Link>
        <Link href="/admin/domains" className={linkClass(pathname === "/admin/domains" || pathname.startsWith("/admin/domains/"))}>
          Domains
        </Link>
        <Link href="/admin/security" className={linkClass(pathname === "/admin/security")}>
          Security
        </Link>
      </nav>
    </aside>
  );
}
