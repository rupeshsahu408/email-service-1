import { stripTrackingFromHtml } from "@/lib/mail-filter";

export type ViewerPrefs = {
  blockTrackers: boolean;
  externalImages: string;
};

export function sanitizeHtmlForViewer(
  html: string | null,
  prefs: ViewerPrefs
): string | null {
  if (!html) return null;
  return stripTrackingFromHtml(html, {
    blockTrackers: prefs.blockTrackers,
    externalImages: prefs.externalImages as "always" | "ask" | "never",
  });
}
