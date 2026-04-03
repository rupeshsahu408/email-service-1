import type { MessageFolder } from "@/db/schema";
import type { InboundDisposition } from "@/lib/inbound-policy";
import { getSenderMailPreferenceForFrom } from "@/lib/sender-mail-preference";
import {
  computeInboundSpamScore,
  SPAM_SCORE_THRESHOLD,
  type SpamScoreBreakdown,
} from "@/lib/spam-detection";
import { logInfo } from "@/lib/logger";

export type ExternalInboundResolution = {
  folder: MessageFolder;
  spamScore: number;
  spamReasons: string[];
  applyLabelId: string | null;
};

/**
 * Decide folder + spam score for **external** mail (e.g. Resend inbound webhook).
 * Filter-rule trash still wins; label is applied only for inbox delivery.
 */
export async function resolveExternalInboundFolder(params: {
  userId: string;
  fromAddr: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  attachmentFilenames: string[];
  disposition: InboundDisposition;
}): Promise<ExternalInboundResolution> {
  if (params.disposition.kind === "trash") {
    return {
      folder: "trash",
      spamScore: 0,
      spamReasons: [],
      applyLabelId: null,
    };
  }

  const pref = await getSenderMailPreferenceForFrom(params.userId, params.fromAddr);
  if (pref === "trust") {
    return {
      folder: "inbox",
      spamScore: 0,
      spamReasons: ["user:trusted_sender"],
      applyLabelId:
        params.disposition.kind === "label" ? params.disposition.labelId : null,
    };
  }

  if (pref === "spam") {
    const forced: SpamScoreBreakdown = {
      score: SPAM_SCORE_THRESHOLD + 3,
      reasons: ["user:spam_sender_pref"],
    };
    return {
      folder: "spam",
      spamScore: forced.score,
      spamReasons: forced.reasons,
      applyLabelId: null,
    };
  }

  const scored = await computeInboundSpamScore({
    userId: params.userId,
    fromAddr: params.fromAddr,
    subject: params.subject,
    bodyText: params.bodyText,
    bodyHtml: params.bodyHtml,
    attachmentFilenames: params.attachmentFilenames,
    includeHistoryRules: true,
  });

  const isSpam = scored.score >= SPAM_SCORE_THRESHOLD;
  const folder: MessageFolder = isSpam ? "spam" : "inbox";

  const applyLabelId =
    !isSpam && params.disposition.kind === "label"
      ? params.disposition.labelId
      : null;

  logInfo("spam_inbound_scored", {
    userId: params.userId,
    folder,
    score: scored.score,
    snippet: scored.reasons.slice(0, 12).join(";").slice(0, 500),
  });

  return {
    folder,
    spamScore: scored.score,
    spamReasons: scored.reasons,
    applyLabelId,
  };
}
