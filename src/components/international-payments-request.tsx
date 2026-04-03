"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export function InternationalPaymentsRequest({
  initialEmail,
  variant = "default",
}: {
  initialEmail: string;
  variant?: "default" | "purpleOutline";
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);

  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [mobileNumber, setMobileNumber] = useState("");

  const fullNameRef = useRef<HTMLInputElement | null>(null);

  const canSubmit = useMemo(() => {
    return Boolean(fullName.trim() && country.trim() && email.trim());
  }, [country, email, fullName]);

  function openModal() {
    setSubmitError("");
    setSubmitted(false);
    setSubmitting(false);

    // Reset fields each open to keep the UX predictable.
    setFullName("");
    setCountry("");
    setEmail(initialEmail);
    setMobileNumber("");

    setMounted(true);
    setVisible(false);
    requestAnimationFrame(() => setVisible(true));
  }

  function closeModal() {
    setVisible(false);
    setTimeout(() => {
      setMounted(false);
    }, 180);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/support/international-payments/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          country: country.trim(),
          email: email.trim(),
          mobileNumber: mobileNumber.trim() || undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (!res.ok || data.ok !== true) {
        setSubmitError(data.error ?? "Could not submit request. Please try again.");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      setSubmitting(false);
    } catch {
      setSubmitError("Could not submit request. Please try again.");
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!mounted) return;

    // Lock body scroll behind the modal.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    // Focus the first input when the modal opens.
    const t = window.setTimeout(() => {
      if (submitted) return;
      fullNameRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [mounted, submitted]);

  useEffect(() => {
    if (!mounted) return;

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted]);

  // If `initialEmail` changes while the modal is not open, keep the email field in sync.
  useEffect(() => {
    if (!mounted) setEmail(initialEmail);
  }, [initialEmail, mounted]);

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={
          variant === "purpleOutline"
            ? "w-full text-center rounded-full border border-white/60 bg-white/10 text-white/95 text-sm font-semibold py-2.5 px-4 hover:bg-white/20 hover:text-white transition-colors"
            : "w-full text-center rounded-full border border-[#e8e4f8] bg-[#faf9fe] text-[#1c1b33] text-sm font-semibold py-2.5 px-4 hover:bg-white transition-colors"
        }
      >
        🌍 Need International Payments?
      </button>

      {mounted && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) closeModal();
          }}
        >
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
              visible ? "opacity-100" : "opacity-0"
            }`}
          />

          <div
            className={`relative w-full max-w-lg transform rounded-2xl border border-[#e8e4f8] bg-white shadow-2xl transition-all duration-200 ${
              visible
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-3 scale-95"
            }`}
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#f0edfb]">
              <div>
                <h3 className="text-base font-bold text-[#1c1b33]">
                  {submitted ? "🎉 Request Submitted" : "International Payments Request"}
                </h3>
                {submitted ? (
                  <p className="mt-2 text-sm text-[#65637e]">
                    Thanks! We’ve received your request for international payments.
                    <br />
                    We’ll notify you as soon as it’s available 🌍
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-[#65637e]">
                    Tell us where you’re located. We’ll use this to measure demand.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="text-[#65637e] hover:text-[#1c1b33] rounded-lg p-2 hover:bg-[#faf9fe]"
              >
                ✕
              </button>
            </div>

            {!submitted ? (
              <form onSubmit={onSubmit} className="px-5 py-4 space-y-4">
                {submitError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {submitError}
                  </p>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-[#1c1b33]">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={fullNameRef}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-[#e8e4f8] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6d4aff]/30 focus:border-[#6d4aff]"
                    placeholder="Your name"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-[#1c1b33]">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                    className="w-full rounded-xl border border-[#e8e4f8] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6d4aff]/30 focus:border-[#6d4aff]"
                    placeholder="e.g. Germany"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-[#1c1b33]">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    type="email"
                    className="w-full rounded-xl border border-[#e8e4f8] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6d4aff]/30 focus:border-[#6d4aff]"
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-[#1c1b33]">
                    Mobile Number <span className="text-[#9896b4]">(optional)</span>
                  </label>
                  <input
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full rounded-xl border border-[#e8e4f8] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6d4aff]/30 focus:border-[#6d4aff]"
                    placeholder="e.g. +44 7123 456789"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-full border border-[#e8e4f8] text-[#65637e] text-sm font-semibold px-5 py-2 hover:bg-[#faf9fe]"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit || submitting}
                    className="rounded-full bg-[#6d4aff] text-white text-sm font-bold px-5 py-2 hover:bg-[#5b3dff] disabled:opacity-60 disabled:hover:bg-[#6d4aff] transition-colors"
                  >
                    {submitting ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="px-5 py-4 pb-5">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-full bg-[#1c1b33] text-white text-sm font-bold px-6 py-2 hover:opacity-90"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

