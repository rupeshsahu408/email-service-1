"use client";

import { useState } from "react";

type Props = { email: string };

export function AdminProfileMenu({ email }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="max-w-[min(100vw-5rem,16rem)] truncate rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-left text-sm text-[var(--foreground)] shadow-sm transition-[background-color,box-shadow,border-color] hover:border-[var(--accent)]/35 hover:bg-[var(--accent-soft)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
      >
        {email}
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 cursor-default bg-black/20 backdrop-blur-[1px] md:bg-transparent md:backdrop-blur-none"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-lg shadow-black/10 ring-1 ring-black/[0.04] dark:ring-white/10"
          >
            <button
              type="button"
              role="menuitem"
              onClick={onLogout}
              disabled={loading}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-60"
            >
              {loading ? "Logging out..." : "Logout"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
