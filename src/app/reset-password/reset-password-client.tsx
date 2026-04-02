"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

async function readJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

type UiState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function ResetPasswordClient() {
  const router = useRouter();
  const search = useSearchParams();
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    const fromQueryToken = (search.get("token") ?? "").trim();
    const fromQueryUser = (search.get("username") ?? "").trim().toLowerCase();
    const fromStorageToken =
      typeof window !== "undefined" ? window.sessionStorage.getItem("reset_token") ?? "" : "";
    const fromStorageUser =
      typeof window !== "undefined" ? window.sessionStorage.getItem("reset_username") ?? "" : "";

    const nextToken = fromQueryToken || fromStorageToken;
    const nextUser = fromQueryUser || fromStorageUser;
    setToken(nextToken);
    setUsername(nextUser);

    if (typeof window !== "undefined" && fromQueryToken && fromQueryUser) {
      window.sessionStorage.setItem("reset_token", fromQueryToken);
      window.sessionStorage.setItem("reset_username", fromQueryUser);
    }
  }, [search]);

  const hasContext = useMemo(() => Boolean(token && username), [token, username]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState<UiState>({ kind: "idle" });

  const [fieldError, setFieldError] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  function validateFields(): boolean {
    const next: { newPassword?: string; confirmPassword?: string } = {};
    if (!newPassword) next.newPassword = "Please enter a new password.";
    if (newPassword && newPassword.length < 12) {
      next.newPassword = "Use at least 12 characters for better account security.";
    }
    if (!confirmPassword) next.confirmPassword = "Please confirm your new password.";
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }
    setFieldError(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "idle" });
    if (!hasContext) {
      setState({
        kind: "error",
        message:
          "Your password reset session is invalid or expired. Please verify your backup file again.",
      });
      return;
    }
    if (!validateFields()) return;

    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/auth/recovery/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username,
          token,
          newPassword,
        }),
      });
      const data = await readJsonResponse<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || !data?.ok) {
        setState({
          kind: "error",
          message:
            data?.error ??
            "Could not update password. Please try again or verify your backup again.",
        });
        return;
      }
      setState({
        kind: "success",
        message: "Password updated. Redirecting to login…",
      });
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("reset_token");
        window.sessionStorage.removeItem("reset_username");
      }
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch {
      setState({
        kind: "error",
        message: "Network error. Check your connection and try again.",
      });
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f0fd] flex flex-col">
      <header className="px-6 py-4">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <img src="/sendora-logo.png" alt="Sendora" className="w-8 h-8 object-contain" />
          <span className="text-[15px] font-bold text-[#1c1b33]">Sendora</span>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#1c1b33] tracking-tight">
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-[#65637e]">
              Choose a new password for your account.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#e8e4f8] shadow-sm p-8">
            {!hasContext ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-700">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-px">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Your password reset session is invalid or expired. Please verify your backup
                  file again.
                </div>
                <Link
                  href="/forgot-password"
                  className="inline-block w-full text-center rounded-full bg-[#6d4aff] py-3 text-sm font-semibold text-white shadow-md shadow-[#6d4aff]/20 hover:bg-[#5b3dff] transition-all"
                >
                  Go to Forgot Password
                </Link>
                <div className="text-center">
                  <Link
                    href="/login"
                    className="text-sm font-semibold text-[#6d4aff] hover:text-[#5b3dff] transition-colors"
                  >
                    Back to login
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1c1b33] uppercase tracking-wider mb-1.5">
                    New password
                  </label>
                  <div className="flex rounded-xl border border-[#e8e4f8] bg-[#f8f5ff] focus-within:border-[#6d4aff] focus-within:bg-white transition-all">
                    <input
                      type="password"
                      className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-[#1c1b33] outline-none placeholder:text-[#9896b4]"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="••••••••••••"
                      required
                      minLength={12}
                    />
                  </div>
                  {fieldError.newPassword ? (
                    <p className="mt-1 text-xs text-red-700">{fieldError.newPassword}</p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1c1b33] uppercase tracking-wider mb-1.5">
                    Confirm password
                  </label>
                  <div className="flex rounded-xl border border-[#e8e4f8] bg-[#f8f5ff] focus-within:border-[#6d4aff] focus-within:bg-white transition-all">
                    <input
                      type="password"
                      className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-[#1c1b33] outline-none placeholder:text-[#9896b4]"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="••••••••••••"
                      required
                      minLength={12}
                    />
                  </div>
                  {fieldError.confirmPassword ? (
                    <p className="mt-1 text-xs text-red-700">{fieldError.confirmPassword}</p>
                  ) : null}
                </div>

                {state.kind === "error" ? (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-700">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-px">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {state.message}
                  </div>
                ) : null}

                {state.kind === "success" ? (
                  <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-100 px-3 py-2.5 text-xs text-green-800">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-px">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.78-9.72a.75.75 0 0 0-1.06-1.06L9.5 10.44 7.78 8.72a.75.75 0 1 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l3.75-3.75Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {state.message}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={state.kind === "loading"}
                  className="w-full rounded-full bg-[#6d4aff] py-3 text-sm font-semibold text-white shadow-md shadow-[#6d4aff]/20 hover:bg-[#5b3dff] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {state.kind === "loading" ? "Updating…" : "Update password"}
                </button>

                <div className="pt-2 text-center">
                  <Link
                    href="/forgot-password"
                    className="text-sm font-semibold text-[#6d4aff] hover:text-[#5b3dff] transition-colors"
                  >
                    Back to verification
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

