"use client";

import { useMemo, useState } from "react";

type PasscodeMode = "email_otp" | "sms_otp";

export function ConfidentialViewerClient({
  token,
  subject,
  expiresAt,
  passcodeMode,
}: {
  token: string;
  subject: string;
  expiresAt: string;
  passcodeMode: PasscodeMode;
}) {
  const expiresLabel = useMemo(() => expiresAt.slice(0, 10), [expiresAt]);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"request" | "verify" | "done">("request");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contentHtml, setContentHtml] = useState<string | null>(null);

  async function requestOtp() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/confidential/${encodeURIComponent(token)}/otp/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Could not send code");
      setStep("verify");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/confidential/${encodeURIComponent(token)}/otp/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const j = (await res.json()) as { error?: string; html?: string };
      if (!res.ok) throw new Error(j.error || "Invalid code");
      setContentHtml(j.html ?? "");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f0fd] flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-[#e8e4f8] shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-[#f0edfb]">
          <div className="text-xs font-semibold text-[#9896b4]">Sendora · Confidential</div>
          <h1 className="text-lg font-semibold text-[#1c1b33] mt-1">{subject}</h1>
          <div className="text-xs text-[#9896b4] mt-1">Expires {expiresLabel}</div>
        </div>

        <div className="px-6 py-6">
          {passcodeMode === "sms_otp" && (
            <div className="text-sm text-[#65637e]">
              SMS OTP is not enabled yet.
            </div>
          )}

          {passcodeMode === "email_otp" && step !== "done" && (
            <div className="space-y-4">
              <div className="text-sm text-[#65637e]">
                Enter your email to receive a one-time code.
              </div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[#e8e4f8] px-3 py-2 text-sm outline-none focus:border-[#6d4aff]"
              />

              {step === "verify" && (
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                  className="w-full rounded-xl border border-[#e8e4f8] px-3 py-2 text-sm outline-none focus:border-[#6d4aff]"
                />
              )}

              {error && <div className="text-sm text-red-600">{error}</div>}

              <div className="flex gap-2">
                {step === "request" ? (
                  <button
                    type="button"
                    onClick={requestOtp}
                    disabled={loading || !email.trim()}
                    className="flex-1 rounded-xl bg-[#6d4aff] text-white text-sm font-semibold py-2.5 disabled:opacity-60"
                  >
                    {loading ? "Sending…" : "Send code"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={verifyOtp}
                    disabled={loading || !email.trim() || code.trim().length < 4}
                    className="flex-1 rounded-xl bg-[#6d4aff] text-white text-sm font-semibold py-2.5 disabled:opacity-60"
                  >
                    {loading ? "Verifying…" : "Unlock message"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setCode("");
                    setStep("request");
                  }}
                  className="rounded-xl border border-[#e8e4f8] px-4 text-sm font-semibold text-[#65637e] hover:border-[#6d4aff]"
                >
                  Restart
                </button>
              </div>
            </div>
          )}

          {step === "done" && contentHtml != null && (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          )}
        </div>
      </div>
    </main>
  );
}

