/**
 * Normalize sender address for blocking / rules (case-insensitive email).
 */
export function parsePrimaryEmail(fromAddr: string): string {
  const t = fromAddr.trim().toLowerCase();
  const angle = t.match(/<([^>]+@[^>]+)>/);
  const raw = angle ? angle[1]! : t;
  return raw.trim();
}

export function matchesSenderPattern(fromAddr: string, pattern: string): boolean {
  const email = parsePrimaryEmail(fromAddr);
  const p = pattern.trim().toLowerCase();
  if (!email || !p) return false;
  if (p.startsWith("@")) {
    const dom = p.slice(1);
    return email.endsWith(`@${dom}`);
  }
  return email === p;
}

const PIXEL =
  /<(img|image)[^>]*\/?>/gi;
const TRACKING_QUERY = /([?&])(utm_[^=]+|fbclid|gclid|mc_[^=]+)=/gi;

export function stripTrackingFromHtml(
  html: string,
  opts: { blockTrackers: boolean; externalImages: "always" | "ask" | "never" }
): string {
  let out = html;
  if (opts.blockTrackers) {
    out = out.replace(PIXEL, (tag) => {
      const lower = tag.toLowerCase();
      if (
        /width\s*=\s*["']?1["']?/.test(lower) &&
        /height\s*=\s*["']?1["']?/.test(lower)
      ) {
        return "";
      }
      if (/tracking|pixel|open\.|beacon/i.test(lower)) return "";
      return tag;
    });
    out = out.replace(TRACKING_QUERY, "$1");
  }
  if (opts.externalImages === "never") {
    out = out.replace(
      /<(img)([^>]*)>/gi,
      '<span data-aura-stripped-img="1" class="text-slate-400 text-xs">[Image hidden]</span>'
    );
  }
  return out;
}
