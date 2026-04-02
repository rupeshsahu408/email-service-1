"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type AnalyticsRange = "today" | "7d" | "30d";

type AnalyticsApiResponse = {
  range: AnalyticsRange;
  start: string;
  end: string;
  summary: {
    emailsReceived: number;
    emailsSent: number;
    spamEmails: number;
    contactsCount: number;
  };
  series: Array<{ day: string; received: number; sent: number }>;
  topContacts: Array<{ email: string; messageCount: number }>;
  mostActiveSender: { email: string; messageCount: number } | null;
};

const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
];

function formatDayLabel(isoDay: string): string {
  const d = new Date(`${isoDay}T12:00:00.000Z`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function SummaryCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9896b4]">
        {title}
      </p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-[#1c1b33]">
        {value.toLocaleString()}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-[#9896b4]">{hint}</p>
      ) : null}
    </div>
  );
}

function ActivityChart({ series }: { series: AnalyticsApiResponse["series"] }) {
  const max = useMemo(() => {
    let m = 1;
    for (const row of series) {
      m = Math.max(m, row.received, row.sent);
    }
    return m;
  }, [series]);

  if (series.length === 0) {
    return (
      <p className="text-sm text-[#65637e] py-8 text-center">
        No days in this range.
      </p>
    );
  }

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div
        className="flex items-end gap-1 min-h-[200px] sm:gap-1.5"
        style={{ minWidth: `${Math.max(series.length * 28, 200)}px` }}
      >
        {series.map((row) => {
          const rh =
            row.received === 0
              ? 0
              : Math.max(Math.round((row.received / max) * 100), 8);
          const sh =
            row.sent === 0
              ? 0
              : Math.max(Math.round((row.sent / max) * 100), 8);
          return (
            <div
              key={row.day}
              className="flex flex-1 flex-col items-center gap-1 min-w-[24px]"
            >
              <div className="flex h-[160px] w-full items-end justify-center gap-0.5">
                <div
                  className="w-[42%] max-w-[14px] rounded-t-md bg-[#6d4aff]/85 transition-all"
                  style={{ height: `${rh}%` }}
                  title={`Received: ${row.received}`}
                />
                <div
                  className="w-[42%] max-w-[14px] rounded-t-md bg-[#00a896]/85 transition-all"
                  style={{ height: `${sh}%` }}
                  title={`Sent: ${row.sent}`}
                />
              </div>
              <span className="text-[9px] sm:text-[10px] text-[#9896b4] text-center leading-tight max-w-[56px] truncate">
                {formatDayLabel(row.day)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-[#65637e]">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-4 rounded-sm bg-[#6d4aff]/85" />
          Received
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-4 rounded-sm bg-[#00a896]/85" />
          Sent
        </span>
      </div>
    </div>
  );
}

export function AnalyticsClient({ email }: { email: string }) {
  const [range, setRange] = useState<AnalyticsRange>("7d");
  const [data, setData] = useState<AnalyticsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (r: AnalyticsRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?range=${encodeURIComponent(r)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Failed to load analytics");
      }
      const json = (await res.json()) as AnalyticsApiResponse;
      setData(json);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [range, load]);

  const isEmpty =
    data &&
    data.summary.emailsReceived === 0 &&
    data.summary.emailsSent === 0 &&
    data.summary.spamEmails === 0 &&
    data.summary.contactsCount === 0;

  return (
    <div className="min-h-screen bg-[#faf9fe] text-[#1c1b33]">
      <header className="sticky top-0 z-40 border-b border-[#e8e4f8] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <Link href="/inbox" className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/sendora-logo.png"
              alt="Sendora"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <span className="text-[15px] font-bold tracking-tight">
              Sendora
            </span>
          </Link>
          <span className="text-sm text-[#65637e] truncate max-w-[200px] sm:max-w-none">
            {email}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Analytics
            </h1>
            <p className="mt-1 text-sm text-[#65637e]">
              Overview of your mailbox activity. More insights coming in later
              phases.
            </p>
          </div>
          <div
            className="inline-flex rounded-xl border border-[#e8e4f8] bg-white p-1 shadow-sm"
            role="tablist"
            aria-label="Date range"
          >
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={range === opt.value}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${
                  range === opt.value
                    ? "bg-[#6d4aff] text-white shadow-sm"
                    : "text-[#65637e] hover:bg-[#f3f0fd] hover:text-[#1c1b33]"
                }`}
                onClick={() => setRange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div
            className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-8 space-y-6 animate-pulse">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl bg-[#e8e4f8]/60"
                />
              ))}
            </div>
            <div className="h-72 rounded-2xl bg-[#e8e4f8]/50" />
            <div className="h-48 rounded-2xl bg-[#e8e4f8]/50" />
          </div>
        ) : data ? (
          <>
            {isEmpty ? (
              <div className="mt-8 rounded-2xl border border-dashed border-[#e8e4f8] bg-white px-6 py-14 text-center">
                <p className="text-base font-semibold text-[#1c1b33]">
                  No activity in this period
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm text-[#65637e]">
                  There are no messages in your mailbox for the selected range.
                  Try a wider range or come back after you send and receive
                  mail.
                </p>
                <Link
                  href="/inbox"
                  className="mt-6 inline-flex rounded-full bg-[#6d4aff] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5b3dff]"
                >
                  Go to Inbox
                </Link>
              </div>
            ) : (
              <>
                <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryCard
                    title="Emails received"
                    value={data.summary.emailsReceived}
                    hint="Inbox, archive & spam"
                  />
                  <SummaryCard
                    title="Emails sent"
                    value={data.summary.emailsSent}
                  />
                  <SummaryCard
                    title="Spam emails"
                    value={data.summary.spamEmails}
                  />
                  <SummaryCard
                    title="Contacts"
                    value={data.summary.contactsCount}
                    hint="Unique addresses you interacted with"
                  />
                </section>

                <section className="mt-8 rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-bold text-[#1c1b33]">
                    Activity
                  </h2>
                  <p className="mt-0.5 text-sm text-[#65637e]">
                    Messages received and sent per day (UTC calendar days).
                  </p>
                  <div className="mt-6">
                    <ActivityChart series={data.series} />
                  </div>
                </section>

                <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-sm sm:p-6">
                    <h2 className="text-lg font-bold text-[#1c1b33]">
                      Top contacts
                    </h2>
                    <p className="mt-0.5 text-sm text-[#65637e]">
                      By total messages with you (sent and received).
                    </p>
                    {data.topContacts.length === 0 ? (
                      <p className="mt-6 text-sm text-[#9896b4]">
                        No contact data yet.
                      </p>
                    ) : (
                      <ol className="mt-4 space-y-3">
                        {data.topContacts.map((c, idx) => (
                          <li
                            key={c.email}
                            className="flex items-start justify-between gap-3 rounded-xl bg-[#faf9fe] px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-[#9896b4]">
                                {idx + 1}.
                              </span>{" "}
                              <span className="text-sm font-medium text-[#1c1b33] break-all">
                                {c.email}
                              </span>
                            </div>
                            <span className="shrink-0 text-sm font-semibold tabular-nums text-[#65637e]">
                              {c.messageCount}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-sm sm:p-6">
                    <h2 className="text-lg font-bold text-[#1c1b33]">
                      Most active sender
                    </h2>
                    <p className="mt-0.5 text-sm text-[#65637e]">
                      Who sent you the most mail in this range (inbox, archive &
                      spam).
                    </p>
                    {!data.mostActiveSender ? (
                      <p className="mt-6 text-sm text-[#9896b4]">
                        No incoming messages in this period.
                      </p>
                    ) : (
                      <div className="mt-6 rounded-xl border border-[#e8e4f8] bg-[#faf9fe] px-4 py-5">
                        <p className="text-sm font-semibold text-[#1c1b33] break-all">
                          {data.mostActiveSender.email}
                        </p>
                        <p className="mt-2 text-sm text-[#65637e]">
                          <span className="font-bold tabular-nums text-[#1c1b33]">
                            {data.mostActiveSender.messageCount}
                          </span>{" "}
                          messages
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

            <div className="mt-10 text-center">
              <Link
                href="/inbox"
                className="text-sm font-semibold text-[#6d4aff] hover:underline"
              >
                ← Back to inbox
              </Link>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
