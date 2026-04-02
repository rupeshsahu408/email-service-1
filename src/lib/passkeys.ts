import "dotenv/config";

import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

const PASSKEY_CHALLENGE_COOKIE = "pk_chal";

let _migrationRan = false;

export async function ensurePasskeyTables(): Promise<void> {
  if (_migrationRan) return;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;
  try {
    const { default: postgres } = await import("postgres");
    const sql = postgres(connectionString, {
      max: 1,
      idle_timeout: 10,
      connect_timeout: 15,
    });
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS passkey_credentials (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          credential_id VARCHAR(512) NOT NULL,
          public_key TEXT NOT NULL,
          counter INTEGER NOT NULL DEFAULT 0,
          transports JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS passkey_credentials_credential_unique
        ON passkey_credentials(credential_id)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS passkey_credentials_user_idx
        ON passkey_credentials(user_id)
      `;
      _migrationRan = true;
    } finally {
      await sql.end();
    }
  } catch {
    // Best-effort; if it fails, routes will return a generic server error.
  }
}

function secureCookie(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    !!process.env.REPLIT_DEV_DOMAIN
  );
}

export type PasskeyChallengeCookie = {
  type: "registration" | "authentication";
  challenge: string;
  userId?: string;
  expiresAt: string;
};

export async function setPasskeyChallengeCookie(value: PasskeyChallengeCookie) {
  const store = await cookies();
  store.set(PASSKEY_CHALLENGE_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
}

export function readPasskeyChallengeFromRequest(
  request: NextRequest
): PasskeyChallengeCookie | null {
  const raw = request.cookies.get(PASSKEY_CHALLENGE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PasskeyChallengeCookie;
    if (!parsed?.challenge || !parsed?.type || !parsed?.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPasskeyChallengeCookie() {
  const store = await cookies();
  store.set(PASSKEY_CHALLENGE_COOKIE, "", {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export function getRpIdFromRequest(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "localhost";
  return host.split(":")[0] || "localhost";
}

export function getExpectedOriginFromRequest(request: NextRequest): string {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost";
  return `${proto}://${host}`;
}

