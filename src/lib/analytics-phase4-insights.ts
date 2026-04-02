import type { Phase3Payload } from "@/lib/analytics-phase3";

/** Mirrors `UserAnalyticsRange` without importing user-analytics (avoid circular file refs). */
export type Phase4Range = "today" | "7d" | "30d";

export type SmartInsight = {
  icon: string;
  text: string;
};

const CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "msn.com",
]);

function median(sortedOrNums: number[]): number {
  if (sortedOrNums.length === 0) return 0;
  const s = [...sortedOrNums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function bestContiguousHourWindow(
  hourly: number[],
  span: number
): { startHour: number; total: number } {
  let best = { startHour: 0, total: -1 };
  for (let s = 0; s < 24; s++) {
    let t = 0;
    for (let k = 0; k < span; k++) {
      t += hourly[(s + k) % 24] ?? 0;
    }
    if (t > best.total) best = { startHour: s, total: t };
  }
  return best;
}

function formatUtcHourRange(startHour: number, spanHours: number): string {
  const endHour = (startHour + spanHours) % 24;
  const fmt = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return `${fmt(startHour)}–${fmt(endHour)} UTC`;
}

export type Phase4Payload = {
  insights: SmartInsight[];
  phase4ComputedAt: string;
};

export function computePhase4Insights(input: {
  range: Phase4Range;
  emailsReceived: number;
  averageReplyTimeMs: number | null;
  hasReplySamples: boolean;
  actionInsights: {
    waitingForReplyCount: number;
    pendingOver24HoursCount: number;
    pendingOver48HoursCount: number;
    pendingOver3DaysCount: number;
    delayedInboxRepliesOver48h: number;
  };
  phase3: Phase3Payload;
  replyInsightSamples: Array<{
    delayMs: number;
    incomingHourUtc: number;
    replyHourUtc: number;
  }>;
  hourlyActivityUtc: number[];
  incomingByDomain: Array<{ domain: string; count: number }>;
  previousAverageReplyMs: number | null;
}): Phase4Payload {
  const candidates: Array<{ priority: number; insight: SmartInsight }> = [];
  const {
    range,
    emailsReceived,
    averageReplyTimeMs,
    hasReplySamples,
    actionInsights,
    phase3,
    replyInsightSamples,
    hourlyActivityUtc,
    incomingByDomain,
    previousAverageReplyMs,
  } = input;

  const totalIncoming = emailsReceived;
  const topDomain = incomingByDomain[0];
  const topDomainShare =
    totalIncoming > 0 && topDomain
      ? Math.round((1000 * topDomain.count) / totalIncoming) / 10
      : 0;

  if (actionInsights.pendingOver3DaysCount > 0) {
    candidates.push({
      priority: 100,
      insight: {
        icon: "🔔",
        text: `You have ${actionInsights.pendingOver3DaysCount} inbox thread${actionInsights.pendingOver3DaysCount === 1 ? "" : "s"} pending reply for more than 3 days.`,
      },
    });
  } else if (actionInsights.pendingOver48HoursCount > 0) {
    candidates.push({
      priority: 98,
      insight: {
        icon: "🔔",
        text: `You have ${actionInsights.pendingOver48HoursCount} inbox message${actionInsights.pendingOver48HoursCount === 1 ? "" : "s"} pending reply for more than 2 days.`,
      },
    });
  } else if (actionInsights.pendingOver24HoursCount > 0) {
    candidates.push({
      priority: 95,
      insight: {
        icon: "🔔",
        text: `You have ${actionInsights.pendingOver24HoursCount} email${actionInsights.pendingOver24HoursCount === 1 ? "" : "s"} needing follow-up (pending over 24 hours).`,
      },
    });
  } else if (actionInsights.waitingForReplyCount > 0 && range !== "today") {
    candidates.push({
      priority: 90,
      insight: {
        icon: "⏱️",
        text: `${actionInsights.waitingForReplyCount} conversation${actionInsights.waitingForReplyCount === 1 ? "" : "s"} in this range still await your reply.`,
      },
    });
  }

  if (
    previousAverageReplyMs !== null &&
    averageReplyTimeMs !== null &&
    hasReplySamples &&
    previousAverageReplyMs > 0 &&
    replyInsightSamples.length >= 3
  ) {
    const deltaPct =
      ((previousAverageReplyMs - averageReplyTimeMs) /
        previousAverageReplyMs) *
      100;
    if (deltaPct >= 12) {
      candidates.push({
        priority: 88,
        insight: {
          icon: "📊",
          text: `Your average reply time improved by about ${Math.round(deltaPct)}% compared with the previous period of the same length.`,
        },
      });
    } else if (deltaPct <= -15) {
      candidates.push({
        priority: 72,
        insight: {
          icon: "📊",
          text: `Replies in this range are taking roughly ${Math.round(-deltaPct)}% longer on average than in the prior period—consider blocking focus time for inbox.`,
        },
      });
    }
  }

  if (actionInsights.delayedInboxRepliesOver48h > 0 && hasReplySamples) {
    candidates.push({
      priority: 85,
      insight: {
        icon: "⚡",
        text: `You replied more than 2 days after arrival on ${actionInsights.delayedInboxRepliesOver48h} inbox message${actionInsights.delayedInboxRepliesOver48h === 1 ? "" : "s"} in this range.`,
      },
    });
  }

  const businessDomainCount = incomingByDomain.filter(
    (d) => !CONSUMER_DOMAINS.has(d.domain.toLowerCase()) && d.count >= 2
  ).length;
  if (businessDomainCount >= 3 && totalIncoming >= 8) {
    candidates.push({
      priority: 70,
      insight: {
        icon: "📊",
        text: `You receive recurring mail from several business domains this period (${businessDomainCount} non-consumer sources with multiple messages).`,
      },
    });
  }

  if (topDomain && topDomainShare >= 35 && totalIncoming >= 5) {
    candidates.push({
      priority: 68,
      insight: {
        icon: "📊",
        text: `About ${topDomainShare}% of your incoming mail in this range is from ${topDomain.domain}.`,
      },
    });
  }

  const hourlyTotal = hourlyActivityUtc.reduce((a, b) => a + b, 0);
  if (hourlyTotal >= 6) {
    const best = bestContiguousHourWindow(hourlyActivityUtc, 3);
    if (best.total >= 2) {
      const share = Math.round((100 * best.total) / hourlyTotal);
      candidates.push({
        priority: 65,
        insight: {
          icon: "⏱️",
          text: `Peak activity clusters around ${formatUtcHourRange(best.startHour, 3)}—about ${share}% of non-trash messages in this range land in that window.`,
        },
      });
    }
  }

  const morning = replyInsightSamples.filter(
    (s) => s.replyHourUtc >= 6 && s.replyHourUtc < 12
  );
  const afternoon = replyInsightSamples.filter(
    (s) => s.replyHourUtc >= 12 && s.replyHourUtc < 18
  );
  if (morning.length >= 4 && afternoon.length >= 4) {
    const medM = median(morning.map((s) => s.delayMs));
    const medA = median(afternoon.map((s) => s.delayMs));
    if (medM > 0 && medA > 0 && medM < medA * 0.8) {
      candidates.push({
        priority: 62,
        insight: {
          icon: "⚡",
          text: `Your replies sent between 06:00–12:00 UTC are typically faster than those sent 12:00–18:00 UTC in this range (median latency).`,
        },
      });
    }
  }

  const topContact = phase3.contactIntelligence.topContacts[0];
  if (topContact && topContact.interactionCount >= 3) {
    candidates.push({
      priority: 55,
      insight: {
        icon: "📊",
        text: `You interact most with ${topContact.email} (${topContact.interactionCount} messages in / out in this range).`,
      },
    });
  }

  candidates.sort((a, b) => b.priority - a.priority);
  const seen = new Set<string>();
  const insights: SmartInsight[] = [];
  for (const c of candidates) {
    const key = c.insight.text.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    insights.push(c.insight);
    if (insights.length >= 5) break;
  }

  if (insights.length === 0 && hourlyTotal > 0) {
    insights.push({
      icon: "📊",
      text: `Keep using this range to compare habits—as more replies and mail flow in, you will see more tailored insights here.`,
    });
  }

  return {
    insights,
    phase4ComputedAt: new Date().toISOString(),
  };
}
