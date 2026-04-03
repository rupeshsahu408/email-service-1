/**
 * Allows only same-origin relative paths (open-redirect safe).
 */
export function safeRelativeRedirectPath(
  raw: string | null | undefined
): string | null {
  if (raw == null || raw === "") return null;
  const s = raw.trim();
  if (!s.startsWith("/") || s.startsWith("//")) return null;
  if (s.includes("://")) return null;
  try {
    const base = "http://internal.local";
    const u = new URL(s, base);
    if (u.origin !== base) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}
