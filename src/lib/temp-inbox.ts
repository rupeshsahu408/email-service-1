import { randomBytes } from "crypto";

export const TEMP_INBOX_DAILY_MAX = Number(
  process.env.TEMP_INBOX_DAILY_MAX ?? "8"
);

export type TempInboxExpiryOption = "10m" | "1h";

export function expiryOptionToMinutes(opt: TempInboxExpiryOption): number {
  return opt === "10m" ? 10 : 60;
}

/**
 * Extract an OTP-like code from email content.
 * Prefers the last 6-digit match; falls back to any 4-8 digit group.
 */
export function extractOtpCode(text: string): string | null {
  const raw = (text ?? "").toString();
  if (!raw.trim()) return null;

  // Handle OTPs with spaced digits like: "1 2 3 4 5 6" or "123 456".
  // We capture digit-sequences with separators, then strip to digits.
  const spacedMatches = Array.from(
    raw.matchAll(/\b(\d(?:[\s\-\.•·]+)\d){3,7}\b/gim)
  ).map((m) => m[1]);
  if (spacedMatches.length > 0) {
    const last = spacedMatches[spacedMatches.length - 1]!;
    const digits = last.replace(/\D/g, "");
    if (digits.length >= 4 && digits.length <= 8) return digits;
  }

  // Common patterns like: "OTP: 123456" or "verification code - 123456".
  const pattern = /(?:otp|one[-\s]?time password|verification code|verification|security code|auth code)\D{0,25}(\d{4,8})/gi;
  const patMatches = Array.from(raw.matchAll(pattern)).map((m) => m[1]);
  if (patMatches.length > 0) {
    const last = patMatches[patMatches.length - 1];
    if (last) return last;
  }

  const sixes = Array.from(raw.matchAll(/\b(\d{6})\b/g)).map((m) => m[1]);
  if (sixes.length > 0) return sixes[sixes.length - 1] ?? null;

  const any4to8 = Array.from(raw.matchAll(/\b(\d{4,8})\b/g)).map(
    (m) => m[1]
  );
  if (any4to8.length > 0) return any4to8[any4to8.length - 1] ?? null;

  // Very loose fallback: capture any 4-8 digits even if they are adjacent
  // to other characters (e.g. "code:123456," or "123456.")
  const loose = raw.match(/(\d{4,8})/g);
  if (loose && loose.length > 0) return loose[loose.length - 1] ?? null;

  return null;
}

export function generateTempLocalPart(bytes = 6): string {
  // 6 bytes => 12 hex chars (good enough for uniqueness and UI readability).
  return randomBytes(bytes).toString("hex");
}

