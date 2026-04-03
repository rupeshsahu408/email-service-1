"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Turnstile } from "@marsidev/react-turnstile";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { SendoraBrandIntro } from "@/components/brand/sendora-brand-intro";

const steps = ["Username", "Verify", "Password", "Backup file", "Passkey"] as const;

async function readJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

function passkeyFriendlyError(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "name" in err) {
    const name = String((err as { name?: string }).name ?? "");
    if (name === "NotAllowedError" || name === "AbortError") {
      return "Passkey setup was cancelled. You can skip for now and add it later in Settings.";
    }
    if (name === "NotSupportedError") {
      return "Passkeys are not available on this device. Continue with password and backup recovery.";
    }
  }
  return fallback;
}

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const stepDescriptions = [
  "Pick your unique email address",
  "Quick human verification",
  "Secure your account",
  "Save your recovery backup",
  "Set up fast sign-in",
];

export function SignupWizard() {
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [savedConfirm, setSavedConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [brandIntroUrl, setBrandIntroUrl] = useState<string | null>(null);

  const isDev = process.env.NODE_ENV === "development";
  const siteKey = isDev ? "" : (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "");
  const domain = process.env.NEXT_PUBLIC_EMAIL_DOMAIN ?? "auramail.app";

  const checkUsername = useCallback(async () => {
    setUsernameError("");
    const q = username.trim();
    if (q.length < 3) { setUsernameError("At least 3 characters."); return false; }
    const res = await fetch(`/api/auth/username?username=${encodeURIComponent(q)}`);
    const data = await readJsonResponse<{ available?: boolean; error?: string }>(res);
    if (data === null) {
      setUsernameError(res.ok ? "Empty response from server." : "Server error. Check DATABASE_URL.");
      return false;
    }
    if (!res.ok) { setUsernameError(data.error ?? "Invalid username"); return false; }
    if (!data.available) { setUsernameError("That address is already taken."); return false; }
    return true;
  }, [username]);

  const nextFromUsername = async () => {
    setLoading(true);
    try { const ok = await checkUsername(); if (ok) setStep(1); }
    finally { setLoading(false); }
  };

  const nextFromCaptcha = () => {
    if (siteKey && !turnstileToken) { setFormError("Complete the verification first."); return; }
    setFormError("");
    setStep(2);
  };

  const submitPassword = async () => {
    setFormError("");
    if (password.length < 12) { setFormError("Password must be at least 12 characters."); return; }
    if (password !== password2) { setFormError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password, turnstileToken: turnstileToken ?? "dev-skip" }),
      });
      const data = await readJsonResponse<{ recoveryKey?: string; email?: string; error?: string }>(res);
      if (data === null) { setFormError("Invalid response from server."); return; }
      if (!res.ok) { setFormError(data.error ?? "Signup failed."); return; }
      if (data.recoveryKey) {
        setRecoveryKey(data.recoveryKey);
        setDownloaded(false);
        setSavedConfirm(false);
        setStep(3);
      }
    } finally { setLoading(false); }
  };

  const copyKey = () => {
    void navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadBackup = () => {
    const u = username.trim().toLowerCase();
    const backup = {
      type: "sendora_backup",
      version: 1,
      username: u,
      recoveryKey,
      createdAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sendora-backup-${u || "account"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  const finishBackup = () => {
    if (!savedConfirm) return;
    setStep(4);
  };

  const skipPasskey = () => {
    setBrandIntroUrl("/inbox");
  };

  const setupPasskey = async () => {
    setFormError("");
    setPasskeyBusy(true);
    try {
      if (typeof window === "undefined" || typeof PublicKeyCredential === "undefined") {
        setFormError("Passkeys are not supported on this device/browser.");
        return;
      }
      const { startRegistration } = await import("@simplewebauthn/browser");
      const optRes = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const optJson = await readJsonResponse<{
        options?: PublicKeyCredentialCreationOptionsJSON;
        error?: string;
      }>(optRes);
      if (!optRes.ok || !optJson?.options) {
        setFormError(optJson?.error ?? "Could not start passkey setup.");
        return;
      }
      const regResp = await startRegistration({ optionsJSON: optJson.options });
      const verifyRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response: regResp }),
      });
      const verifyJson = await readJsonResponse<{ ok?: boolean; error?: string }>(verifyRes);
      if (!verifyRes.ok || !verifyJson?.ok) {
        setFormError(verifyJson?.error ?? "Passkey setup failed.");
        return;
      }
      setBrandIntroUrl("/inbox");
    } catch (err) {
      setFormError(
        passkeyFriendlyError(
          err,
          "Passkey setup failed. You can skip now and add it later in Settings."
        )
      );
    } finally {
      setPasskeyBusy(false);
    }
  };

  return (
    <>
    {brandIntroUrl ? (
      <SendoraBrandIntro
        onComplete={() => {
          window.location.assign(brandIntroUrl);
        }}
      />
    ) : null}
    <div className="min-h-screen flex">
      {/* ── Left brand panel (hidden on mobile) ── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] flex-col justify-between bg-[#1c1b33] p-10 relative overflow-hidden">
        {/* Background decorative blobs */}
        <div className="pointer-events-none absolute -top-32 -right-32 w-80 h-80 rounded-full bg-[#6d4aff]/20 blur-[80px]" />
        <div className="pointer-events-none absolute bottom-10 -left-20 w-64 h-64 rounded-full bg-[#4f35cc]/20 blur-[60px]" />

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5 w-fit">
            <img src="/sendora-logo.png" alt="Sendora" className="w-9 h-9 object-contain" />
            <span className="text-[17px] font-bold text-white tracking-tight">Sendora</span>
          </Link>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-snug tracking-tight">
              Your private inbox<br />
              <span className="text-[#a78bfa]">ready in seconds</span>
            </h2>
            <p className="mt-4 text-[#9896b4] text-sm leading-relaxed max-w-xs">
              No phone number. No credit card. Just a secure @{domain} address that&apos;s yours.
            </p>
          </div>

          {/* Step progress visualization */}
          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={s} className={`flex items-center gap-3 transition-all ${i <= step ? "opacity-100" : "opacity-30"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${i < step ? "bg-[#6d4aff] text-white" : i === step ? "bg-[#6d4aff]/30 text-[#a78bfa] ring-1 ring-[#6d4aff]/50" : "bg-white/10 text-white/40"}`}>
                  {i < step ? (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  ) : i + 1}
                </div>
                <div>
                  <div className={`text-sm font-medium ${i === step ? "text-white" : "text-[#c5c3d8]"}`}>{s}</div>
                  <div className="text-xs text-[#65637e]">{stepDescriptions[i]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-xs text-[#65637e]">
            © {new Date().getFullYear()} Sendora. Privacy-first email.
          </p>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col bg-[#f3f0fd]">
        {/* Mobile-only header */}
        <header className="lg:hidden px-6 py-4">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <img src="/sendora-logo.png" alt="Sendora" className="w-8 h-8 object-contain" />
            <span className="text-[15px] font-bold text-[#1c1b33]">Sendora</span>
          </Link>
        </header>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            {/* Title */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-[#1c1b33] tracking-tight">Create your account</h1>
              <p className="mt-1.5 text-sm text-[#65637e]">
                Step {step + 1} of {steps.length}: {steps[step]}
              </p>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1.5 mb-6">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= step ? "bg-[#6d4aff]" : "bg-[#e8e4f8]"}`}
                />
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-[#e8e4f8] shadow-sm p-8">
              {/* Step 0: Username */}
              {step === 0 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#1c1b33] uppercase tracking-wider mb-1.5">
                      Choose your address
                    </label>
                    <div className={`flex rounded-xl border bg-[#f8f5ff] focus-within:bg-white transition-all ${usernameError ? "border-red-300 focus-within:border-red-400" : "border-[#e8e4f8] focus-within:border-[#6d4aff]"}`}>
                      <input
                        className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-[#1c1b33] outline-none placeholder:text-[#9896b4]"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && nextFromUsername()}
                        placeholder="your-name"
                        autoComplete="off"
                      />
                      <span className="shrink-0 px-3 py-2.5 text-sm text-[#9896b4] border-l border-[#e8e4f8]">
                        @{domain}
                      </span>
                    </div>
                    {usernameError && (
                      <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" /></svg>
                        {usernameError}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-[#9896b4]">3–64 characters, letters and numbers only.</p>
                  </div>
                  <button
                    type="button"
                    onClick={nextFromUsername}
                    disabled={loading}
                    className="w-full rounded-full bg-[#6d4aff] py-3 text-sm font-semibold text-white shadow-md shadow-[#6d4aff]/20 hover:bg-[#5b3dff] transition-all disabled:opacity-60 mt-2"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                        Checking…
                      </span>
                    ) : "Continue →"}
                  </button>
                </div>
              )}

              {/* Step 1: Captcha */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1c1b33] mb-1">Verify you&apos;re human</h3>
                    <p className="text-xs text-[#65637e]">A quick check to protect accounts from bots.</p>
                  </div>
                  {siteKey ? (
                    <div className="flex justify-center">
                      <Turnstile siteKey={siteKey} onSuccess={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                      <span className="font-semibold">Development mode:</span> Captcha is bypassed automatically.
                    </div>
                  )}
                  {formError && <p className="text-xs text-red-600">{formError}</p>}
                  <button
                    type="button"
                    onClick={nextFromCaptcha}
                    className="w-full rounded-full bg-[#6d4aff] py-3 text-sm font-semibold text-white hover:bg-[#5b3dff] transition-all"
                  >
                    Continue →
                  </button>
                </div>
              )}

              {/* Step 2: Password */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#1c1b33] uppercase tracking-wider mb-1.5">
                      Password
                    </label>
                    <div className="flex rounded-xl border border-[#e8e4f8] bg-[#f8f5ff] focus-within:border-[#6d4aff] focus-within:bg-white transition-all">
                      <input
                        type={showPw ? "text" : "password"}
                        className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-[#1c1b33] outline-none placeholder:text-[#9896b4]"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 12 characters"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPw(!showPw)}
                        className="px-3 text-[#9896b4] hover:text-[#6d4aff] transition-colors"
                      >
                        {showPw ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    {password.length > 0 && (
                      <div className="mt-1.5 flex gap-1">
                        {[12, 16, 20, 24].map((len) => (
                          <div key={len} className={`h-1 flex-1 rounded-full transition-all duration-300 ${password.length >= len ? "bg-[#6d4aff]" : "bg-[#e8e4f8]"}`} />
                        ))}
                      </div>
                    )}
                    {password.length > 0 && (
                      <p className="mt-1 text-xs text-[#9896b4]">
                        {password.length < 12 ? "Too short" : password.length < 16 ? "Good" : password.length < 20 ? "Strong" : "Very strong"}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1c1b33] uppercase tracking-wider mb-1.5">
                      Confirm password
                    </label>
                    <div className="flex rounded-xl border border-[#e8e4f8] bg-[#f8f5ff] focus-within:border-[#6d4aff] focus-within:bg-white transition-all">
                      <input
                        type={showPw2 ? "text" : "password"}
                        className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-[#1c1b33] outline-none placeholder:text-[#9896b4]"
                        value={password2}
                        onChange={(e) => setPassword2(e.target.value)}
                        placeholder="Repeat your password"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPw2(!showPw2)}
                        className="px-3 text-[#9896b4] hover:text-[#6d4aff] transition-colors"
                      >
                        {showPw2 ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    {password2.length > 0 && password !== password2 && (
                      <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
                    )}
                    {password2.length > 0 && password === password2 && password.length >= 12 && (
                      <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" /></svg>
                        Passwords match
                      </p>
                    )}
                  </div>
                  {formError && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" /></svg>
                      {formError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={submitPassword}
                    disabled={loading}
                    className="w-full rounded-full bg-[#6d4aff] py-3 text-sm font-semibold text-white shadow-md shadow-[#6d4aff]/20 hover:bg-[#5b3dff] transition-all disabled:opacity-60 mt-2"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                        Creating account…
                      </span>
                    ) : "Create account →"}
                  </button>
                </div>
              )}

              {/* Step 3: Backup file */}
              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1c1b33]">
                      Download your backup file
                    </h3>
                    <p className="mt-1 text-xs text-[#65637e]">
                      Keep this file safe. You will need it if you ever forget your password.
                    </p>
                    <p className="mt-2 text-xs text-[#65637e]">
                      This backup file helps you reset your password if you lose access to your account.
                    </p>
                    <p className="mt-1 text-xs text-[#65637e]">
                      You can regenerate and download a new backup from Settings → Security at any time.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={downloadBackup}
                    className={`w-full rounded-full py-3 text-sm font-semibold transition-all shadow-md ${downloaded ? "bg-green-600 text-white shadow-green-600/20 hover:bg-green-700" : "bg-[#6d4aff] text-white shadow-[#6d4aff]/20 hover:bg-[#5b3dff]"}`}
                  >
                    {downloaded ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" /></svg>
                        Downloaded
                      </span>
                    ) : "Download backup file"}
                  </button>

                  <div className="rounded-xl border border-[#e8e4f8] bg-[#f8f5ff] p-4">
                    <p className="text-xs font-semibold text-[#1c1b33] mb-1">
                      Optional: copy your recovery key
                    </p>
                    <p className="text-xs text-[#65637e]">
                      Your backup file contains this key. We cannot show it again later.
                    </p>
                    <div className="mt-3 relative">
                      <div className="rounded-xl border border-[#e8e4f8] bg-white p-3 font-mono text-[11px] text-[#1c1b33] break-all leading-relaxed">
                        {recoveryKey}
                      </div>
                      <button
                        type="button"
                        onClick={copyKey}
                        className={`absolute top-2 right-2 rounded-lg border px-2 py-1 text-xs font-semibold transition-all ${copied ? "bg-[#6d4aff] border-[#6d4aff] text-white" : "bg-white border-[#e8e4f8] text-[#65637e] hover:border-[#6d4aff] hover:text-[#6d4aff]"}`}
                      >
                        {copied ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={savedConfirm}
                      onChange={(e) => setSavedConfirm(e.target.checked)}
                      className="mt-0.5 accent-[#6d4aff]"
                    />
                    <span className="text-sm text-[#65637e]">
                      I have saved my backup file in a secure place.
                    </span>
                  </label>
                  {!downloaded && (
                    <p className="text-xs text-[#9896b4]">
                      Tip: download the file now and store it somewhere safe (password manager / encrypted drive).
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={finishBackup}
                    disabled={!savedConfirm}
                    className="w-full rounded-full bg-[#6d4aff] py-3 text-sm font-semibold text-white shadow-md shadow-[#6d4aff]/20 hover:bg-[#5b3dff] transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2"
                  >
                    Continue →
                  </button>
                </div>
              )}

              {/* Step 4: Passkey (optional) */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="text-center pb-2">
                    <div className="w-14 h-14 rounded-2xl bg-[#f3f0fd] text-[#6d4aff] flex items-center justify-center mx-auto mb-4">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-7 h-7">
                        <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04.054-.09A13.916 13.916 0 0 0 8 11a4 4 0 1 1 8 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0 0 15.171 17m3.839 1.132c.645-2.266.999-4.659.999-7.132A8 8 0 0 0 4.07 8m12.995 13" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-[#1c1b33]">
                      Set up Passkey <span className="text-[#9896b4] font-normal">(optional)</span>
                    </h3>
                    <p className="mt-1 text-xs text-[#65637e] max-w-xs mx-auto">
                      Passkeys let you sign in with your device security — Face ID, fingerprint, or PIN. No password needed.
                    </p>
                  </div>

                  {formError && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" /></svg>
                      {formError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={setupPasskey}
                    disabled={passkeyBusy}
                    className="w-full rounded-full bg-[#6d4aff] py-3 text-sm font-semibold text-white shadow-md shadow-[#6d4aff]/20 hover:bg-[#5b3dff] transition-all disabled:opacity-60"
                  >
                    {passkeyBusy ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                        Opening passkey…
                      </span>
                    ) : "Add Passkey"}
                  </button>
                  <button
                    type="button"
                    onClick={skipPasskey}
                    className="w-full rounded-full bg-white border border-[#e8e4f8] py-3 text-sm font-semibold text-[#1c1b33] hover:bg-[#faf8ff] transition-all"
                  >
                    Skip for now
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 text-center text-sm text-[#65637e]">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-[#6d4aff] hover:text-[#5b3dff] transition-colors">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
