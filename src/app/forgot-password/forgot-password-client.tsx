"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

async function readJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

type VerifyState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function ForgotPasswordClient() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [supportUsername, setSupportUsername] = useState("");
  const [supportUsernameError, setSupportUsernameError] = useState("");
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [backupText, setBackupText] = useState("");
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [verifyState, setVerifyState] = useState<VerifyState>({ kind: "idle" });
  const [supportState, setSupportState] = useState<VerifyState>({ kind: "idle" });
  const [supportCooldownUntil, setSupportCooldownUntil] = useState<number>(0);

  const effectiveBackupText = useMemo(() => backupText.trim(), [backupText]);

  async function getBackupPayload(): Promise<string> {
    if (backupFile) return await backupFile.text();
    return effectiveBackupText;
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setSupportState({ kind: "idle" });
    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedUsername) {
      setVerifyState({ kind: "error", message: "Enter your username to continue." });
      return;
    }
    if (!backupFile && !effectiveBackupText) {
      setVerifyState({
        kind: "error",
        message: "Upload your backup file or paste your recovery key/backup content.",
      });
      return;
    }
    if (backupFile && backupFile.size > 100_000) {
      setVerifyState({
        kind: "error",
        message: "Backup file is too large. Use the original backup file or recovery key.",
      });
      return;
    }
    setVerifyState({ kind: "loading" });
    try {
      const payload = await getBackupPayload();
      const res = await fetch("/api/auth/recovery/verify-backup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          backupText: payload,
        }),
      });
      const data = await readJsonResponse<{
        ok?: boolean;
        error?: string;
        resetToken?: string | null;
        expiresAt?: string;
        message?: string;
      }>(res);
      if (!res.ok || !data?.ok) {
        setVerifyState({
          kind: "error",
          message:
            data?.error ??
            "We could not verify that backup for this account. Check the username and backup file, then try again.",
        });
        return;
      }
      if (!data.resetToken) {
        setVerifyState({
          kind: "success",
          message:
            data.message ??
            "Recovery was already verified recently. Continue from your existing reset-password page.",
        });
        return;
      }
      const exp = data.expiresAt ? new Date(data.expiresAt).toLocaleTimeString() : "";
      setVerifyState({
        kind: "success",
        message: exp
          ? `Backup verified. Continue now (reset session expires around ${exp}).`
          : "Backup verified. Continue to create a new password.",
      });
      const u = normalizedUsername;
      router.push(
        `/reset-password?token=${encodeURIComponent(data.resetToken)}&username=${encodeURIComponent(u)}`
      );
    } catch {
      setVerifyState({
        kind: "error",
        message: "Network error. Check your connection and try again.",
      });
    }
  }

  function openSupportModal() {
    setSupportState({ kind: "idle" });
    setSupportUsernameError("");
    setSupportUsername(username.trim().toLowerCase());
    setShowSupportModal(true);
  }

  async function onSupportRequest() {
    const now = Date.now();
    if (now < supportCooldownUntil) {
      const secs = Math.max(1, Math.ceil((supportCooldownUntil - now) / 1000));
      setSupportState({
        kind: "error",
        message: `Please wait ${secs}s before sending another request.`,
      });
      return;
    }
    setVerifyState({ kind: "idle" });
    setSupportState({ kind: "loading" });
    try {
      const normalizedUsername = supportUsername.trim().toLowerCase();
      if (!normalizedUsername) {
        setSupportUsernameError("Please enter your username.");
        setSupportState({ kind: "idle" });
        return;
      }
      setSupportUsernameError("");
      const res = await fetch("/api/auth/recovery/support-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: normalizedUsername,
          source: "forgot_password",
          hasBackupFile: Boolean(backupFile || effectiveBackupText),
        }),
      });
      const data = await readJsonResponse<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || !data?.ok) {
        setSupportState({
          kind: "error",
          message: data?.error ?? "Could not send support request. Please try again.",
        });
        return;
      }
      setSupportState({
        kind: "success",
        message: "Support request sent. Please wait for assistance.",
      });
      setSupportCooldownUntil(Date.now() + 60_000);
      setShowSupportModal(false);
    } catch {
      setSupportState({
        kind: "error",
        message: "Network error. Check your connection and try again.",
      });
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f0fd] flex flex-col">
      <header className="px-6 py-4">
        <Link href="/login" className="flex items-center gap-2 w-fit">
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
            <div className="mt-2 text-sm text-[#65637e] space-y-1">
              <p>Upload or enter your backup file to verify your identity.</p>
              <p>If your backup file is valid, you will be able to continue.</p>
              <p>If you do not have your backup file, contact support.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e8e4f8] shadow-sm p-8">
            <form onSubmit={onVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1c1b33] uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <div className="flex rounded-xl border border-[#e8e4f8] bg-[#f8f5ff] focus-within:border-[#6d4aff] focus-within:bg-white transition-all">
                  <input
                    className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-[#1c1b33] outline-none placeholder:text-[#9896b4]"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="your-username"
                  />
                </div>
                <p className="mt-1 text-xs text-[#9896b4]">
                  Used to match your backup to the correct account.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1c1b33] uppercase tracking-wider mb-1.5">
                  Backup file
                </label>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e8e4f8] bg-[#f8f5ff] px-3 py-2.5">
                  <input
                    type="file"
                    accept=".json,.txt,application/json,text/plain"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setBackupFile(f);
                      if (f && f.size > 100_000) {
                        setVerifyState({
                          kind: "error",
                          message:
                            "Backup file is too large. Upload the original backup file or paste only your recovery key.",
                        });
                      } else {
                        setVerifyState({ kind: "idle" });
                      }
                    }}
                    className="text-sm text-[#1c1b33] file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#1c1b33] file:shadow-sm"
                  />
                  {backupFile ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#6d4aff] hover:text-[#5b3dff] transition-colors"
                      onClick={() => setBackupFile(null)}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-semibold text-[#1c1b33] uppercase tracking-wider mb-1.5">
                    Or paste backup content
                  </label>
                  <textarea
                    value={backupText}
                    onChange={(e) => setBackupText(e.target.value)}
                    rows={5}
                    placeholder="Paste your backup JSON or recovery key here"
                    className="w-full resize-y rounded-xl border border-[#e8e4f8] bg-[#f8f5ff] px-3 py-2.5 text-sm text-[#1c1b33] outline-none placeholder:text-[#9896b4] focus:border-[#6d4aff] focus:bg-white transition-all"
                  />
                </div>
              </div>

              {verifyState.kind === "error" ? (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-700">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-px">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {verifyState.message}
                </div>
              ) : null}

              {verifyState.kind === "success" ? (
                <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-100 px-3 py-2.5 text-xs text-green-800">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-px">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.78-9.72a.75.75 0 0 0-1.06-1.06L9.5 10.44 7.78 8.72a.75.75 0 1 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l3.75-3.75Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {verifyState.message}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={verifyState.kind === "loading"}
                className="w-full rounded-full bg-[#6d4aff] py-3 text-sm font-semibold text-white shadow-md shadow-[#6d4aff]/20 hover:bg-[#5b3dff] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {verifyState.kind === "loading" ? "Verifying…" : "Verify backup"}
              </button>

              <button
                type="button"
                onClick={openSupportModal}
                disabled={supportState.kind === "loading" || Date.now() < supportCooldownUntil}
                className="w-full rounded-full bg-white border border-[#e8e4f8] py-3 text-sm font-semibold text-[#1c1b33] hover:bg-[#faf8ff] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {Date.now() < supportCooldownUntil
                  ? "Request sent recently"
                  : "You do not have your backup file?"}
              </button>

              {supportState.kind === "error" ? (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-700">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-px">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {supportState.message}
                </div>
              ) : null}

              {supportState.kind === "success" ? (
                <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-100 px-3 py-2.5 text-xs text-green-800">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-px">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.78-9.72a.75.75 0 0 0-1.06-1.06L9.5 10.44 7.78 8.72a.75.75 0 1 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l3.75-3.75Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {supportState.message}
                </div>
              ) : null}

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="text-sm font-semibold text-[#6d4aff] hover:text-[#5b3dff] transition-colors"
                >
                  Back to login
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
      {showSupportModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#e8e4f8] bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-[#1c1b33]">Contact support</h2>
            <p className="mt-1.5 text-sm text-[#65637e]">
              Enter your username so we can help recover your account.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-[#1c1b33] uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="flex rounded-xl border border-[#e8e4f8] bg-[#f8f5ff] focus-within:border-[#6d4aff] focus-within:bg-white transition-all">
                <input
                  className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-[#1c1b33] outline-none placeholder:text-[#9896b4]"
                  value={supportUsername}
                  onChange={(e) => setSupportUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="your-username"
                />
              </div>
              {supportUsernameError ? (
                <p className="mt-1 text-xs text-red-700">{supportUsernameError}</p>
              ) : null}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSupportModal(false);
                  setSupportUsernameError("");
                }}
                className="rounded-full border border-[#e8e4f8] px-4 py-2 text-sm font-semibold text-[#1c1b33] hover:bg-[#faf8ff] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSupportRequest}
                disabled={supportState.kind === "loading"}
                className="rounded-full bg-[#6d4aff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5b3dff] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {supportState.kind === "loading" ? "Sending…" : "Send support request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

