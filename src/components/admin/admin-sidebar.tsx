"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function linkClass(active: boolean) {
  return active
    ? "block rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[var(--accent)] shadow-[inset_2px_0_0_0_var(--accent)] transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
    : "block rounded-lg px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors duration-150 hover:bg-[var(--background)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30";
}

export function AdminSidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="w-full border-b border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_4px_24px_-12px_rgba(28,27,51,0.08)] md:min-h-screen md:w-64 md:border-b-0 md:border-r md:shadow-[4px_0_32px_-16px_rgba(28,27,51,0.1)]">
      <Link
        href="/admin/dashboard"
        className="mb-6 flex items-center gap-2.5 rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]"
      >
        <img
          src="/sendora-logo.png"
          alt=""
          className="h-8 w-8 object-contain"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--foreground)]">
            Sendora Admin
          </p>
          <p className="text-xs text-[var(--muted)]">Operations</p>
        </div>
      </Link>
      <nav className="space-y-0.5" aria-label="Admin navigation">
        <Link
          href="/admin/dashboard"
          className={linkClass(pathname === "/admin/dashboard")}
        >
          Dashboard
        </Link>
        <Link
          href="/admin/users"
          className={linkClass(
            pathname === "/admin/users" || pathname.startsWith("/admin/users/")
          )}
        >
          Users
        </Link>
        <Link
          href="/admin/domains"
          className={linkClass(
            pathname === "/admin/domains" ||
              pathname.startsWith("/admin/domains/")
          )}
        >
          Domains
        </Link>
        <Link
          href="/admin/security"
          className={linkClass(pathname === "/admin/security")}
        >
          Security
        </Link>
        <Link
          href="/admin/settings"
          className={linkClass(pathname === "/admin/settings")}
        >
          Settings
        </Link>
      </nav>
    </aside>
  );
}
