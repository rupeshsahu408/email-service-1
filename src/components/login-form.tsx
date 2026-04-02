"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { safeRelativeRedirectPath } from "@/lib/safe-redirect";
import { SendoraBrandIntro } from "@/components/brand/sendora-brand-intro";

async function readJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

function passkeyFriendlyError(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "name" in err) {
    const name = String((err as { name?: string }).name ?? "");
    if (name === "NotAllowedError" || name === "AbortError") {
      return "Passkey request was cancelled. You can try again or sign in with your password.";
    }
    if (name === "NotSupportedError") {
      return "This device does not support passkeys. Use your password and backup recovery instead.";
    }
  }
  return fallback;
}

function postLoginTarget(
  apiRedirect: string | undefined,
  nextSafe: string | null
): string {
  if (apiRedirect === "/admin/dashboard") return apiRedirect;
  return nextSafe ?? apiRedirect ?? "/inbox";
}

export function LoginForm({ nextParam }: { nextParam?: string }) {
  const router = useRouter();
  const nextSafe = useMemo(
    () => safeRelativeRedirectPath(nextParam),
    [nextParam]
  );
  useEffect(() => {
    router.prefetch("/inbox");
  }, [router]);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [brandIntroUrl, setBrandIntroUrl] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const data = await readJsonResponse<{ error?: string; ok?: boolean; redirectTo?: string }>(res);
      if (data === null) {
        setError(res.ok ? "Empty response from server." : `Sign-in failed (HTTP ${res.status}).`);
        return;
      }
      if (!res.ok) { setError(data.error ?? "Login failed."); return; }
      setBrandIntroUrl(postLoginTarget(data.redirectTo, nextSafe));
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function onPasskeyLogin() {
    setError("");
    setPasskeyLoading(true);
    try {
      if (typeof window === "undefined" || typeof PublicKeyCredential === "undefined") {
        setError("Passkeys are not supported on this device/browser.");
        return;
      }

      const optRes = await fetch("/api/auth/passkey/login/options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
      });
      const optJson = await readJsonResponse<{
        ok?: boolean;
        options?: PublicKeyCredentialRequestOptionsJSON;
        error?: string;
      }>(optRes);
      if (!optRes.ok || !optJson?.ok || !optJson.options) {
        setError(optJson?.error ?? "Could not start passkey login.");
        return;
      }

      const authResp = await startAuthentication({ optionsJSON: optJson.options });
      const verifyRes = await fetch("/api/auth/passkey/login/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response: authResp }),
      });
      const verifyJson = await readJsonResponse<{ ok?: boolean; error?: string; redirectTo?: string }>(verifyRes);
      if (!verifyRes.ok || !verifyJson?.ok) {
        setError(verifyJson?.error ?? "Passkey login failed.");
        return;
      }
      setBrandIntroUrl(postLoginTarget(verifyJson?.redirectTo, nextSafe));
    } catch (err) {
      setError(
        passkeyFriendlyError(
          err,
          "Passkey sign-in could not be completed. Use your password or try again."
        )
      );
    } finally {
      setPasskeyLoading(false);
    }
  }

  return (
    <>
    {brandIntroUrl ? (
      <SendoraBrandIntro
        onComplete={() => {
          window.location.assign(brandIntroUrl);
        }}
      />
    ) : null}
    <div className="min-h-screen bg-[#f3f0fd] flex flex-col">
      {/* Header */}
      <header className="px-6 py-4">
        <Link href="/signup" className="flex items-center gap-2 w-fit">
          <img src="/sendora-logo.png" alt="Sendora" className="w-8 h-8 object-contain" />
          <span className="text-[15px] font-bold text-[#1c1b33]">Sendora</span>
        </Link>
      </header>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#1c1b33] tracking-tight">Welcome back</h1>
            <p className="mt-1.5 text-sm text-[#65637e]">Sign in to your Sendora account</p>
          </div>

          <div className="bg-white rounded-2xl border border-[#e8e4f8] shadow-sm p-8">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1c1b33] uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <div className="flex rounded-xl border border-[#e8e4f8] bg-[#f8f5ff] focus-within:border-[#6d4aff] focus-within:bg-white transition-all">
                  <input
                    className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-[#1c1b33] outline-none placeholder:text-[#9896b4]"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#1c1b33] uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="flex rounded-xl border border-[#e8e4f8] bg-[#f8f5ff] focus-within:border-[#6d4aff] focus-within:bg-white transition-all">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-[#1c1b33] outline-none placeholder:text-[#9896b4]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="px-3 text-[#9896b4] hover:text-[#6d4aff] transition-colors"
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-700">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-px"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" /></svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[#6d4aff] py-3 text-sm font-semibold text-white shadow-md shadow-[#6d4aff]/20 hover:bg-[#5b3dff] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                    Signing in…
                  </span>
                ) : "Sign in"}
              </button>
              <button
                type="button"
                onClick={onPasskeyLogin}
                disabled={passkeyLoading || loading}
                className="w-full rounded-full bg-white border border-[#e8e4f8] py-3 text-sm font-semibold text-[#1c1b33] hover:bg-[#faf8ff] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {passkeyLoading ? "Opening passkey…" : "Login with Passkey"}
              </button>
              <p className="text-center text-xs text-[#9896b4]">
                If passkey fails, continue with password or use{" "}
                <Link href="/forgot-password" className="text-[#6d4aff] hover:text-[#5b3dff]">
                  backup recovery
                </Link>
                .
              </p>
              <div className="text-center">
                <Link
                  href="/forgot-password"
                  className="inline-block text-sm font-semibold text-[#6d4aff] hover:text-[#5b3dff] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            </form>

            <div className="mt-6 pt-5 border-t border-[#f0edfb] text-center">
              <p className="text-sm text-[#65637e]">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="font-semibold text-[#6d4aff] hover:text-[#5b3dff] transition-colors">
                  Create one free
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-[#9896b4]">
            By signing in, you agree to our privacy-first approach — no tracking, no ads.
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
