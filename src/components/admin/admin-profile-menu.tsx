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
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-[#e8e4f8] bg-white px-3 py-1.5 text-sm text-[#1c1b33] hover:bg-[#faf8ff]"
      >
        {email}
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-2 w-44 rounded-xl border border-[#ece9fb] bg-white p-2 shadow-lg">
          <button
            onClick={onLogout}
            disabled={loading}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#1c1b33] hover:bg-[#f7f4ff] disabled:opacity-60"
          >
            {loading ? "Logging out..." : "Logout"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
