import { ResetPasswordClient } from "./reset-password-client";
import { Suspense } from "react";

export const metadata = {
  title: "Reset password — Sendora",
};

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f3f0fd] flex items-center justify-center px-6">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#e8e4f8] shadow-sm p-8">
            <div className="flex items-center justify-center gap-2 text-sm text-[#65637e]">
              <svg
                className="animate-spin w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeOpacity="0.3"
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              Loading reset form…
            </div>
          </div>
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}

