/**
 * Public site origin for links in transactional emails (verify, password reset).
 */
export function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }
  const replitDev = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (replitDev) {
    const host = replitDev.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return "http://localhost:5000";
}
