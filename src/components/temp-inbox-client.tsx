"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TempInboxAlias = {
  id: string;
  emailAddress: string;
  expiresAt: string; // ISO
  expiryMinutes: number;
  remainingMs: number;
};

type TempInboxMessage = {
  id: string;
  receivedAt: string;
  fromAddr: string;
  subject: string;
  snippet: string;
  otpCode: string | null;
  otpMatchedAt: string | null;
};

function formatRemaining(ms: number): string {
  const clamped = Math.max(0, ms);
  const s = Math.floor(clamped / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

export function TempInboxClient() {
  const [alias, setAlias] = useState<TempInboxAlias | null>(null);
  const [messages, setMessages] = useState<TempInboxMessage[]>([]);
  const [expiryOption, setExpiryOption] = useState<"10m" | "1h">("10m");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string>("");
  const [remainingMs, setRemainingMs] = useState<number>(0);

  const expiryTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const latestOtp = useMemo(() => {
    const msg = messages.find((m) => Boolean(m.otpCode));
    if (!msg?.otpCode) return null;
    return msg;
  }, [messages]);

  async function loadCurrent() {
    setErr("");
    try {
      const res = await fetch("/api/temp-inbox/current", {
        credentials: "include",
      });
      if (res.status === 403 || res.status === 401) {
        window.location.href = "/temp-inbox/upgrade";
        return;
      }
      const j = (await res.json()) as {
        alias: TempInboxAlias | null;
        messages: TempInboxMessage[];
      };
      setAlias(j.alias);
      setMessages(j.messages ?? []);
      setLoading(false);
    } catch {
      setErr("Could not load temporary inbox.");
      setLoading(false);
    }
  }

  async function regenAlias() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/temp-inbox/alias", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expiryOption }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        alias?: TempInboxAlias;
        error?: string;
      };

      if (!res.ok || !j.alias) {
        setErr(j.error ?? "Could not generate email.");
        return;
      }

      setAlias(j.alias);
      setMessages([]);
    } catch {
      setErr("Could not generate email.");
    } finally {
      setBusy(false);
    }
  }

  async function copyEmail() {
    if (!alias) return;
    await navigator.clipboard.writeText(alias.emailAddress).catch(() => {
      // ignore
    });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  useEffect(() => {
    void loadCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (expiryTickRef.current) clearInterval(expiryTickRef.current);
    if (!alias?.expiresAt) return;

    const expTs = new Date(alias.expiresAt).getTime();
    setRemainingMs(expTs - Date.now());
    expiryTickRef.current = setInterval(() => {
      setRemainingMs(expTs - Date.now());
    }, 500);

    return () => {
      if (expiryTickRef.current) clearInterval(expiryTickRef.current);
      expiryTickRef.current = null;
    };
  }, [alias?.expiresAt]);

  useEffect(() => {
    const id = setInterval(() => {
      // lightweight polling for new OTP.
      void loadCurrent();
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alias?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-[#1c1b33] flex items-center justify-center">
        Loading temporary inbox…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f0fd] text-[#1c1b33]">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-[#e8e4f8] px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <div className="font-bold text-lg">Temporary Inbox</div>
          <button
            type="button"
            onClick={() => window.location.href = "/inbox"}
            className="text-sm font-semibold text-[#6d4aff] hover:underline"
          >
            Back to Inbox
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-6 space-y-5">
        {err && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {err}
          </p>
        )}

        <section className="rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-sm">
          {alias ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-[#65637e] font-semibold">
                    Your temporary email
                  </div>
                  <div className="break-all font-extrabold text-xl">
                    {alias.emailAddress}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void copyEmail()}
                  className="shrink-0 rounded-full border border-[#e8e4f8] px-4 py-2 text-sm font-semibold hover:bg-[#faf9fe] active:scale-[0.98] active:opacity-90 transition-transform"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5">
                  <span className="text-xs font-bold text-emerald-800">
                    Expires in {formatRemaining(remainingMs)}
                  </span>
                </div>

                <div className="inline-flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#65637e]">Next expiry</span>
                  <select
                    className="rounded-xl border border-[#e8e4f8] bg-white px-3 py-2 text-sm font-semibold"
                    value={expiryOption}
                    onChange={(e) => setExpiryOption(e.target.value as "10m" | "1h")}
                  >
                    <option value="10m">10 min</option>
                    <option value="1h">1 hour</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => void regenAlias()}
                  disabled={busy}
                  className="rounded-full bg-[#1c1b33] text-white text-sm font-bold py-2.5 hover:opacity-90 disabled:opacity-60 active:scale-[0.98] active:opacity-90 transition-transform"
                >
                  {busy ? "Generating…" : "Regenerate email"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-[#65637e] font-semibold">
                No active temporary inbox. Generate one.
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="rounded-xl border border-[#e8e4f8] bg-white px-3 py-2 text-sm font-semibold"
                  value={expiryOption}
                  onChange={(e) => setExpiryOption(e.target.value as "10m" | "1h")}
                >
                  <option value="10m">10 min</option>
                  <option value="1h">1 hour</option>
                </select>
                <button
                  type="button"
                  onClick={() => void regenAlias()}
                  disabled={busy}
                  className="rounded-full bg-[#1c1b33] text-white text-sm font-bold px-5 py-2.5 hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? "Generating…" : "Generate temporary email"}
                </button>
              </div>
            </div>
          )}
        </section>

        {latestOtp && (
          <section className="rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-sm">
            <div className="text-sm text-[#65637e] font-semibold mb-2">Latest OTP</div>
            <div className="text-3xl font-extrabold tracking-tight text-[#1c1b33]">
              {latestOtp.otpCode}
            </div>
            <div className="mt-1 text-sm text-[#65637e]">
              From: {latestOtp.fromAddr}
            </div>
            {latestOtp.subject && (
              <div className="text-sm text-[#65637e]">{latestOtp.subject}</div>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold">Inbox</div>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => {
                setRefreshing(true);
                void loadCurrent().finally(() => setRefreshing(false));
              }}
              className="text-sm font-semibold text-[#6d4aff] hover:underline disabled:opacity-60 active:scale-[0.98] active:opacity-90 transition-transform"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {messages.length === 0 ? (
            <div className="text-sm text-[#65637e]">
              Waiting for OTP emails…
            </div>
          ) : (
            <div className="space-y-3">
              {messages.slice(0, 20).map((m) => (
                <div key={m.id} className="rounded-xl border border-[#f0edfb] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#65637e]">
                        {new Date(m.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="font-bold truncate">{m.fromAddr}</div>
                      {m.subject && (
                        <div className="text-sm text-[#65637e] truncate">{m.subject}</div>
                      )}
                    </div>
                    {m.otpCode ? (
                      <div className="shrink-0 rounded-full bg-[#6d4aff]/10 border border-[#6d4aff]/30 px-3 py-1.5 text-sm font-extrabold text-[#6d4aff]">
                        OTP {m.otpCode}
                      </div>
                    ) : (
                      <div className="shrink-0 text-xs text-[#9896b4] font-semibold">
                        OTP not found
                      </div>
                    )}
                  </div>

                  {m.snippet && (
                    <div className="mt-2 text-sm text-[#65637e] line-clamp-3">
                      {m.snippet}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

