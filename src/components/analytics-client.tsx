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
  response: {
    averageReplyTimeMs: number | null;
    fastestReplyTimeMs: number | null;
    slowestReplyTimeMs: number | null;
    totalPendingReplies: number;
    hasReplySamples: boolean;
  };
  productivity: {
    inboxClearedPercentage: number | null;
    unreadEmailsCount: number;
    repliedEmailsCount: number;
    archivedOrTrashedEmailsCount: number;
  };
  actionInsights: {
    waitingForReplyCount: number;
    pendingOver24HoursCount: number;
    pendingOver48HoursCount: number;
    pendingOver3DaysCount: number;
    delayedInboxRepliesOver48h: number;
    pendingEmails: Array<{
      id: string;
      threadId: string;
      subject: string;
      fromAddr: string;
      createdAt: string;
    }>;
  };
  phase2ComputedAt: string;
  phase3: {
    contactIntelligence: {
      topContacts: Array<{
        email: string;
        interactionCount: number;
        receivedInRange: number;
        sentInRange: number;
        relationshipScore: "strong" | "medium" | "low";
      }>;
      newContactsCount: number;
      inactiveContactsCount: number;
      mostActiveSender: { email: string; messageCount: number } | null;
      mostActiveRecipient: { email: string; messageCount: number } | null;
    };
    categories: {
      business: number;
      personal: number;
      finance: number;
      spam: number;
      total: number;
      topCategory: "business" | "personal" | "finance" | "spam" | null;
      topCategoryPercentage: number | null;
      insightLine: string;
      usedAiRefinement: boolean;
      aiRefinedMessageCount: number;
    };
    phase3ComputedAt: string;
  };
  phase4: {
    insights: Array<{ icon: string; text: string }>;
    phase4ComputedAt: string;
  };
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

function SummaryCardText({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9896b4]">
        {title}
      </p>
      <p className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-[#1c1b33] break-words">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-[#9896b4]">{hint}</p>
      ) : null}
    </div>
  );
}

function formatDurationMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 60_000) {
    return `${Math.max(1, Math.round(ms / 1000))} sec`;
  }
  if (ms < 3600_000) {
    return `${Math.max(1, Math.round(ms / 60_000))} min`;
  }
  const h = Math.floor(ms / 3600_000);
  const m = Math.round((ms % 3600_000) / 60_000);
  if (h >= 48) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
  }
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function RelationshipBadge({
  score,
}: {
  score: "strong" | "medium" | "low";
}) {
  const styles = {
    strong: "bg-emerald-100 text-emerald-900 border-emerald-200",
    medium: "bg-amber-100 text-amber-950 border-amber-200",
    low: "bg-slate-100 text-slate-700 border-slate-200",
  } as const;
  const labels = { strong: "Strong", medium: "Medium", low: "Low" } as const;
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${styles[score]}`}
    >
      {labels[score]}
    </span>
  );
}

function CategoryDonut({
  categories,
}: {
  categories: AnalyticsApiResponse["phase3"]["categories"];
}) {
  const { business, personal, finance, spam, total } = categories;
  if (total <= 0) {
    return (
      <div className="flex h-44 w-44 shrink-0 items-center justify-center rounded-full border border-dashed border-[#e8e4f8] bg-[#faf9fe] text-center text-xs text-[#9896b4] px-4">
        No messages in range to chart
      </div>
    );
  }
  const t = total;
  const degBusiness = (business / t) * 360;
  const degPersonal = (personal / t) * 360;
  const degFinance = (finance / t) * 360;
  const degSpam = (spam / t) * 360;
  let a = 0;
  const a1 = a + degBusiness;
  a = a1;
  const a2 = a + degPersonal;
  a = a2;
  const a3 = a + degFinance;
  a = a3;
  const a4 = a + degSpam;
  const gradient = `conic-gradient(
    #5b4dff 0deg ${a1}deg,
    #00a896 ${a1}deg ${a2}deg,
    #e6a100 ${a2}deg ${a3}deg,
    #9b87b3 ${a3}deg ${a4}deg
  )`;
  return (
    <div
      className="relative h-44 w-44 shrink-0"
      role="img"
      aria-label={`Email categories: ${business} business, ${personal} personal, ${finance} finance, ${spam} spam`}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: gradient }}
      />
      <div className="absolute inset-[24%] flex items-center justify-center rounded-full bg-white shadow-inner">
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9896b4]">
            Total
          </p>
          <p className="text-lg font-bold tabular-nums text-[#1c1b33]">
            {total.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatRelativeWaiting(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600_000)}h ago`;
  const days = Math.floor(diff / 86400000);
  return `${days}d ago`;
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
  const [useAiCategories, setUseAiCategories] = useState(false);
  const [data, setData] = useState<AnalyticsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (r: AnalyticsRange, ai: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const aiParam = ai ? "&ai=1" : "";
      const res = await fetch(
        `/api/analytics?range=${encodeURIComponent(r)}${aiParam}`,
        {
        credentials: "same-origin",
        cache: "no-store",
        }
      );
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
    void load(range, useAiCategories);
  }, [range, useAiCategories, load]);

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
              Mailbox activity, response times, productivity, and what needs your
              attention—all scoped to the range you select.
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={`r-${i}`}
                  className="h-28 rounded-2xl bg-[#e8e4f8]/55"
                />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={`p-${i}`}
                  className="h-28 rounded-2xl bg-[#e8e4f8]/50"
                />
              ))}
            </div>
            <div className="h-52 rounded-2xl bg-[#e8e4f8]/45" />
            <div className="h-40 rounded-2xl bg-[#e8e4f8]/43" />
            <div className="h-64 rounded-2xl bg-[#e8e4f8]/42" />
            <div className="h-72 rounded-2xl bg-[#e8e4f8]/40" />
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

                <section className="mt-10 rounded-2xl border border-[#e8e4f8] bg-gradient-to-br from-[#f8f6ff] via-white to-[#f0faf8] p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-bold text-[#1c1b33]">
                    Smart insights
                  </h2>
                  <p className="mt-0.5 text-sm text-[#65637e]">
                    Rule-based highlights from your real mailbox patterns (UTC
                    clocks for timing). Not AI-generated.
                  </p>
                  {data.phase4.insights.length === 0 ? (
                    <p className="mt-4 text-sm text-[#9896b4]">
                      No insights for this range yet.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {data.phase4.insights.map((insight, idx) => (
                        <li
                          key={`${idx}-${insight.text.slice(0, 24)}`}
                          className="flex gap-3 rounded-xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm"
                        >
                          <span
                            className="text-xl leading-none"
                            aria-hidden
                          >
                            {insight.icon}
                          </span>
                          <p className="min-w-0 flex-1 text-sm leading-relaxed text-[#1c1b33]">
                            {insight.text}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="mt-10">
                  <h2 className="text-lg font-bold text-[#1c1b33]">
                    Response analytics
                  </h2>
                  <p className="mt-0.5 text-sm text-[#65637e]">
                    Reply time is measured from each incoming message to your next
                    sent message in the same thread. Pending replies are inbox
                    messages in this range that do not yet have a sent reply
                    after them.
                  </p>
                  {!data.response.hasReplySamples ? (
                    <p className="mt-4 rounded-xl border border-[#e8e4f8] bg-white px-4 py-3 text-sm text-[#65637e]">
                      No reply data available for this period. When you reply to
                      mail in scoped threads, averages will appear here.
                    </p>
                  ) : null}
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <SummaryCardText
                      title="Average reply time"
                      value={formatDurationMs(data.response.averageReplyTimeMs)}
                      hint={data.response.hasReplySamples ? "Mean of all reply spans" : undefined}
                    />
                    <SummaryCardText
                      title="Fastest reply"
                      value={formatDurationMs(data.response.fastestReplyTimeMs)}
                    />
                    <SummaryCardText
                      title="Slowest reply"
                      value={formatDurationMs(data.response.slowestReplyTimeMs)}
                    />
                    <SummaryCard
                      title="Pending replies"
                      value={data.response.totalPendingReplies}
                      hint="Inbox, no sent reply yet"
                    />
                  </div>
                </section>

                <section className="mt-10">
                  <h2 className="text-lg font-bold text-[#1c1b33]">
                    Productivity
                  </h2>
                  <p className="mt-0.5 text-sm text-[#65637e]">
                    Inbox cleared % covers inbox, archive, and trash mail
                    received in this period (spam excluded). Archived/trashed
                    counts incoming messages currently in those folders from
                    this period.
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <SummaryCardText
                      title="Inbox cleared"
                      value={
                        data.productivity.inboxClearedPercentage !== null
                          ? `${data.productivity.inboxClearedPercentage}%`
                          : "—"
                      }
                      hint={
                        data.productivity.inboxClearedPercentage === null
                          ? "No inbox/archive/trash mail in this range"
                          : "Read, archived, trashed, or replied"
                      }
                    />
                    <SummaryCard
                      title="Unread emails"
                      value={data.productivity.unreadEmailsCount}
                      hint="Inbox, still in range"
                    />
                    <SummaryCard
                      title="Replied emails"
                      value={data.productivity.repliedEmailsCount}
                      hint="Incoming in range with a sent reply after"
                    />
                    <SummaryCard
                      title="Archived / trashed"
                      value={data.productivity.archivedOrTrashedEmailsCount}
                      hint="Incoming filed away from inbox"
                    />
                  </div>
                </section>

                <section className="mt-10 rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-bold text-[#1c1b33]">
                    Action insights
                  </h2>
                  <p className="mt-0.5 text-sm text-[#65637e]">
                    Pending inbox threads from the selected range that still need
                    a reply.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <div className="rounded-xl border border-[#e8e4f8] bg-[#faf9fe] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9896b4]">
                        Waiting for reply
                      </p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-[#1c1b33]">
                        {data.actionInsights.waitingForReplyCount.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#e8e4f8] bg-[#faf9fe] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9896b4]">
                        Pending over 24 hours
                      </p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-[#1c1b33]">
                        {data.actionInsights.pendingOver24HoursCount.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#e8e4f8] bg-[#faf9fe] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9896b4]">
                        Pending over 3 days
                      </p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-[#1c1b33]">
                        {data.actionInsights.pendingOver3DaysCount.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {data.actionInsights.pendingEmails.length === 0 ? (
                    <div className="mt-6 rounded-xl border border-dashed border-[#e8e4f8] bg-[#faf9fe] px-4 py-10 text-center text-sm text-[#65637e]">
                      No emails waiting for a reply in this range. You&apos;re all
                      caught up here.
                    </div>
                  ) : (
                    <div className="mt-6 overflow-x-auto rounded-xl border border-[#e8e4f8]">
                      <table className="w-full min-w-[520px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-[#e8e4f8] bg-[#faf9fe] text-[11px] font-semibold uppercase tracking-wider text-[#9896b4]">
                            <th className="px-3 py-2.5 font-semibold">Subject</th>
                            <th className="px-3 py-2.5 font-semibold">From</th>
                            <th className="px-3 py-2.5 font-semibold whitespace-nowrap">
                              Waiting
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.actionInsights.pendingEmails.map((row) => (
                            <tr
                              key={row.id}
                              className="border-b border-[#f0edfb] last:border-0"
                            >
                              <td className="max-w-[220px] px-3 py-2.5 font-medium text-[#1c1b33]">
                                <span className="line-clamp-2" title={row.subject}>
                                  {row.subject}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-[#65637e] break-all">
                                {row.fromAddr || "—"}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-[#65637e] tabular-nums">
                                {formatRelativeWaiting(row.createdAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="mt-3 text-xs text-[#9896b4]">
                    Open{" "}
                    <Link href="/inbox" className="font-semibold text-[#6d4aff] hover:underline">
                      Inbox
                    </Link>{" "}
                    to reply; up to 50 threads shown.
                  </p>
                </section>

                <section className="mt-10 rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-bold text-[#1c1b33]">
                    Contact intelligence
                  </h2>
                  <p className="mt-0.5 text-sm text-[#65637e]">
                    Contacts are normalized email addresses from mail you sent
                    and received (&quot;New&quot; means first seen in this
                    range; &quot;Inactive&quot; had prior activity but none
                    here). Relationship scores use two-way volume in this range:
                    strong = regular back-and-forth, medium = some ongoing
                    thread, low = light touch.
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <SummaryCard
                      title="New contacts"
                      value={data.phase3.contactIntelligence.newContactsCount}
                      hint="First interaction in this range"
                    />
                    <SummaryCard
                      title="Inactive contacts"
                      value={
                        data.phase3.contactIntelligence.inactiveContactsCount
                      }
                      hint="No activity in range, prior history"
                    />
                    <SummaryCardText
                      title="Most active sender"
                      value={
                        data.phase3.contactIntelligence.mostActiveSender
                          ? data.phase3.contactIntelligence.mostActiveSender
                              .email
                          : "—"
                      }
                      hint={
                        data.phase3.contactIntelligence.mostActiveSender
                          ? `${data.phase3.contactIntelligence.mostActiveSender.messageCount.toLocaleString()} received in range`
                          : "No incoming in range"
                      }
                    />
                    <SummaryCardText
                      title="Most active recipient"
                      value={
                        data.phase3.contactIntelligence.mostActiveRecipient
                          ? data.phase3.contactIntelligence.mostActiveRecipient
                              .email
                          : "—"
                      }
                      hint={
                        data.phase3.contactIntelligence.mostActiveRecipient
                          ? `${data.phase3.contactIntelligence.mostActiveRecipient.messageCount.toLocaleString()} sent in range`
                          : "No outbound in range"
                      }
                    />
                  </div>
                  {data.phase3.contactIntelligence.topContacts.length === 0 ? (
                    <p className="mt-6 text-sm text-[#9896b4]">
                      No contact interactions in this range.
                    </p>
                  ) : (
                    <div className="mt-6 overflow-x-auto rounded-xl border border-[#e8e4f8]">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-[#e8e4f8] bg-[#faf9fe] text-[11px] font-semibold uppercase tracking-wider text-[#9896b4]">
                            <th className="px-3 py-2.5 font-semibold">#</th>
                            <th className="px-3 py-2.5 font-semibold">
                              Contact
                            </th>
                            <th className="px-3 py-2.5 font-semibold text-right">
                              In
                            </th>
                            <th className="px-3 py-2.5 font-semibold text-right">
                              Out
                            </th>
                            <th className="px-3 py-2.5 font-semibold text-right">
                              Total
                            </th>
                            <th className="px-3 py-2.5 font-semibold">
                              Relationship
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.phase3.contactIntelligence.topContacts.map(
                            (row, idx) => (
                              <tr
                                key={row.email}
                                className="border-b border-[#f0edfb] last:border-0"
                              >
                                <td className="px-3 py-2.5 text-[#9896b4] tabular-nums">
                                  {idx + 1}
                                </td>
                                <td className="max-w-[200px] px-3 py-2.5 font-medium text-[#1c1b33] break-all">
                                  {row.email}
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-[#65637e]">
                                  {row.receivedInRange}
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-[#65637e]">
                                  {row.sentInRange}
                                </td>
                                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#1c1b33]">
                                  {row.interactionCount}
                                </td>
                                <td className="px-3 py-2.5">
                                  <RelationshipBadge
                                    score={row.relationshipScore}
                                  />
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="mt-10 rounded-2xl border border-[#e8e4f8] bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-[#1c1b33]">
                        Category analytics
                      </h2>
                      <p className="mt-0.5 text-sm text-[#65637e]">
                        Hybrid: strong signals use rules; optional{" "}
                        <span className="font-semibold text-[#5b3dff]">AI</span>{" "}
                        can refine ambiguous &quot;personal&quot; buckets (server
                        needs <code className="text-xs">GEMINI_API_KEY</code>).
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 rounded-xl border border-[#e8e4f8] bg-[#faf9fe] px-3 py-2 text-sm text-[#44435a] cursor-pointer select-none shrink-0">
                      <input
                        type="checkbox"
                        className="rounded border-[#d9d3f3] accent-[#6d4aff]"
                        checked={useAiCategories}
                        onChange={(e) => setUseAiCategories(e.target.checked)}
                      />
                      <span>
                        Use <span className="font-semibold text-[#5b3dff]">AI</span>{" "}
                        refinement
                      </span>
                    </label>
                  </div>
                  {data.phase3.categories.usedAiRefinement &&
                  data.phase3.categories.aiRefinedMessageCount > 0 ? (
                    <p className="mt-3 text-xs font-medium text-[#5b3dff]">
                      AI relabeled{" "}
                      {data.phase3.categories.aiRefinedMessageCount} ambiguous
                      message
                      {data.phase3.categories.aiRefinedMessageCount === 1
                        ? ""
                        : "s"}{" "}
                      in this range.
                    </p>
                  ) : useAiCategories ? (
                    <p className="mt-3 text-xs text-[#9896b4]">
                      No ambiguous rows needed AI in this range, or AI is
                      unavailable.
                    </p>
                  ) : null}
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <SummaryCard
                      title="Business"
                      value={data.phase3.categories.business}
                    />
                    <SummaryCard
                      title="Personal"
                      value={data.phase3.categories.personal}
                    />
                    <SummaryCard
                      title="Finance"
                      value={data.phase3.categories.finance}
                    />
                    <SummaryCard
                      title="Spam"
                      value={data.phase3.categories.spam}
                    />
                  </div>
                  <div className="mt-8 flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:justify-center sm:gap-12">
                    <CategoryDonut categories={data.phase3.categories} />
                    <div className="w-full max-w-xs space-y-2 text-sm">
                      {(
                        [
                          ["Business", data.phase3.categories.business, "#5b4dff"],
                          ["Personal", data.phase3.categories.personal, "#00a896"],
                          ["Finance", data.phase3.categories.finance, "#e6a100"],
                          ["Spam", data.phase3.categories.spam, "#9b87b3"],
                        ] as const
                      ).map(([label, n, color]) => {
                        const pct =
                          data.phase3.categories.total > 0
                            ? Math.round((1000 * n) / data.phase3.categories.total) /
                              10
                            : 0;
                        return (
                          <div
                            key={label}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="inline-flex items-center gap-2 text-[#65637e]">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                                style={{ background: color }}
                              />
                              {label}
                            </span>
                            <span className="tabular-nums text-[#1c1b33]">
                              {n.toLocaleString()}{" "}
                              <span className="text-[#9896b4]">
                                ({pct}%)
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="mt-8 rounded-xl border border-[#e8e4f8] bg-[#faf9fe] px-4 py-3 text-sm font-medium text-[#1c1b33]">
                    {data.phase3.categories.insightLine}
                  </p>
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
