"use client";

import { useState } from "react";

type LoginResponse = { ok?: boolean; error?: string };

async function readJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await readJsonResponse<LoginResponse>(res);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Invalid credentials");
        return;
      }
      window.location.assign("/admin/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-[#e8e4f8] bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight text-[#1c1b33]">Admin login</h1>
      <p className="mt-1 text-sm text-[#65637e]">Sign in with your admin email and password.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#1c1b33]">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="admin@sendora.com"
            required
            className="w-full rounded-xl border border-[#e8e4f8] bg-[#f8f5ff] px-3 py-2.5 text-sm text-[#1c1b33] outline-none transition-all placeholder:text-[#9896b4] focus:border-[#6d4aff] focus:bg-white"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#1c1b33]">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••••••"
            required
            className="w-full rounded-xl border border-[#e8e4f8] bg-[#f8f5ff] px-3 py-2.5 text-sm text-[#1c1b33] outline-none transition-all placeholder:text-[#9896b4] focus:border-[#6d4aff] focus:bg-white"
          />
        </div>
        {error ? (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[#6d4aff] py-3 text-sm font-semibold text-white transition-all hover:bg-[#5b3dff] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
