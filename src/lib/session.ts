import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomBytes, randomUUID } from "crypto";
import { getDb } from "@/db";
import { browserAccountLinks, sessions, users } from "@/db/schema";
import { sha256Hex } from "./hash";
import { ACCOUNT_BUNDLE_COOKIE, ADMIN_SESSION_COOKIE, SESSION_COOKIE } from "./constants";
import { getAdminSystemSettings } from "@/lib/admin-system-settings";

/** Session lifetime: 30 days. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const LAST_USED_TOUCH_MS = 5 * 60 * 1000;

/**
 * Whether the cookie should be marked Secure.
 * Always true in production. Also true in development when running on Replit
 * (REPLIT_DEV_DOMAIN is set), because Replit proxies the dev server over HTTPS,
 * so browsers enforce Secure-cookie rules even in development mode.
 */
function isSecureContext(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    !!process.env.REPLIT_DEV_DOMAIN
  );
}

function sessionCookieBase() {
  return {
    httpOnly: true as const,
    secure: isSecureContext(),
    sameSite: "lax" as const,
    path: "/",
  };
}

export function hashSessionToken(token: string): string {
  return sha256Hex(token);
}

export type SessionMeta = {
  userAgent?: string;
  ipHint?: string;
};

export type IssuedSession = {
  token: string;
  expiresAt: Date;
};

type PgErrorLike = {
  message?: string;
  code?: string;
  detail?: string;
  hint?: string;
  cause?: unknown;
  // wrappers sometimes stash the original error here
  originalError?: unknown;
  error?: unknown;
};

function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v === "bigint") return v.toString();
      if (typeof v === "object" && v !== null) {
        if (seen.has(v)) return "[Circular]";
        seen.add(v);
      }
      return v;
    },
    2
  );
}

function unwrapDbError(err: unknown): unknown {
  // Prefer common wrapper fields and Error.cause, but avoid infinite loops.
  const visited = new Set<unknown>();
  let cur: unknown = err;
  for (let i = 0; i < 6; i++) {
    if (cur == null) return cur;
    if (visited.has(cur)) return cur;
    visited.add(cur);

    const e = cur as PgErrorLike;
    const next =
      e.originalError ??
      e.error ??
      (e.cause instanceof Error || typeof e.cause === "object" ? e.cause : undefined);
    if (!next) return cur;
    cur = next;
  }
  return cur;
}

function logDbError(context: string, err: unknown) {
  const root = unwrapDbError(err) as PgErrorLike;
  const e = (err ?? {}) as PgErrorLike;

  const pick = (x: PgErrorLike) => ({
    message: x?.message,
    code: x?.code,
    detail: x?.detail,
    hint: x?.hint,
    cause: x?.cause,
  });

  const serialized = (() => {
    if (err == null) return null;
    if (typeof err !== "object") return { value: err };
    const names = Object.getOwnPropertyNames(err);
    const out: Record<string, unknown> = {};
    for (const n of names) out[n] = (err as Record<string, unknown>)[n];
    return out;
  })();

  console.error(
    `[session] ${context}`,
    safeJsonStringify({
      topLevel: pick(e),
      root: pick(root),
      serialized,
    })
  );
}

/**
 * Run the schema migration inline. Safe to call multiple times — uses
 * ADD COLUMN IF NOT EXISTS so it's fully idempotent.
 */
let _migrationRan = false;
async function ensureColumns(): Promise<void> {
  if (_migrationRan) return;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;
  try {
    const { default: postgres } = await import("postgres");
    const sql = postgres(connectionString, { max: 1, idle_timeout: 10, connect_timeout: 15 });
    try {
      await sql`
        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS local_part VARCHAR(64),
          ADD COLUMN IF NOT EXISTS password_hash TEXT,
          ADD COLUMN IF NOT EXISTS recovery_key_hash TEXT,
          ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT,
          ADD COLUMN IF NOT EXISTS password_reset_token_expires_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS password_reset_token_used_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS avatar_url TEXT,
          ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ADD COLUMN IF NOT EXISTS plan VARCHAR(16) NOT NULL DEFAULT 'free',
          ADD COLUMN IF NOT EXISTS plan_status VARCHAR(16) NOT NULL DEFAULT 'free',
          ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(128),
          ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(128),
          ADD COLUMN IF NOT EXISTS razorpay_plan_id VARCHAR(128),
          ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS subscription_auto_renew BOOLEAN DEFAULT TRUE NOT NULL,
          ADD COLUMN IF NOT EXISTS pro_plan_status VARCHAR(16) NOT NULL DEFAULT 'free',
          ADD COLUMN IF NOT EXISTS pro_plan_expires_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS pro_razorpay_subscription_id VARCHAR(128),
          ADD COLUMN IF NOT EXISTS pro_razorpay_plan_id VARCHAR(128),
          ADD COLUMN IF NOT EXISTS pro_next_billing_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS pro_billing_period_start TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS pro_subscription_auto_renew BOOLEAN DEFAULT TRUE NOT NULL,
          ADD COLUMN IF NOT EXISTS temp_inbox_plan_status VARCHAR(16) NOT NULL DEFAULT 'free',
          ADD COLUMN IF NOT EXISTS temp_inbox_plan_expires_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS temp_razorpay_subscription_id VARCHAR(128),
          ADD COLUMN IF NOT EXISTS temp_razorpay_plan_id VARCHAR(128),
          ADD COLUMN IF NOT EXISTS temp_next_billing_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS temp_subscription_auto_renew BOOLEAN DEFAULT TRUE NOT NULL,
          ADD COLUMN IF NOT EXISTS full_name VARCHAR(256) NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT NOT NULL DEFAULT 5368709120,
          ADD COLUMN IF NOT EXISTS admin_notes TEXT,
          ADD COLUMN IF NOT EXISTS account_type VARCHAR(32) NOT NULL DEFAULT 'personal',
          ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT,
          ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS security_locked_until TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS security_lock_reason TEXT
      `;
      await sql`
        ALTER TABLE sessions
          ADD COLUMN IF NOT EXISTS user_id UUID,
          ADD COLUMN IF NOT EXISTS token_hash TEXT,
          ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS user_agent TEXT,
          ADD COLUMN IF NOT EXISTS ip_hint VARCHAR(45),
          ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS browser_account_links (
          bundle_id VARCHAR(64) NOT NULL,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (bundle_id, user_id)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS browser_account_links_bundle_idx
        ON browser_account_links(bundle_id)
      `;
      _migrationRan = true;
      console.log("[session] Schema columns auto-applied.");
    } finally {
      await sql.end();
    }
  } catch (err) {
    logDbError("ensureColumns failed", err);
  }
}

/** Run idempotent DB column migrations (users, sessions). Safe before login queries. */
export async function ensureSessionSchema(): Promise<void> {
  await ensureColumns();
}

/**
 * Creates the DB session row. Call {@link attachSessionCookie} on the
 * Route Handler's `NextResponse` so `Set-Cookie` is actually sent.
 */
export async function issueSession(
  userId: string,
  meta?: SessionMeta
): Promise<IssuedSession> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  let ttlSeconds = SESSION_MAX_AGE_SECONDS;
  try {
    const settings = await getAdminSystemSettings();
    ttlSeconds = Math.max(
      300,
      Math.floor(settings.security.sessionTimeoutMinutes * 60)
    );
  } catch {
    ttlSeconds = SESSION_MAX_AGE_SECONDS;
  }
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const now = new Date();
  await getDb().insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
    userAgent: meta?.userAgent ?? null,
    ipHint: meta?.ipHint?.slice(0, 45) ?? null,
    lastUsedAt: now,
  });
  return { token, expiresAt };
}

/** Set persistent session cookie on the outgoing response. */
export function attachSessionCookie(
  res: NextResponse,
  token: string,
  expiresAt: Date
) {
  const maxAge = Math.max(
    1,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000)
  );
  res.cookies.set(SESSION_COOKIE, token, {
    ...sessionCookieBase(),
    maxAge,
    expires: expiresAt,
  });
}

/** Set admin-only session cookie on the outgoing response. */
export function attachAdminSessionCookie(
  res: NextResponse,
  token: string,
  expiresAt: Date
) {
  const maxAge = Math.max(
    1,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000)
  );
  res.cookies.set(ADMIN_SESSION_COOKIE, token, {
    ...sessionCookieBase(),
    maxAge,
    expires: expiresAt,
  });
}

/** Expire the session cookie on the outgoing response. */
export function clearSessionCookieOnResponse(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieBase(),
    maxAge: 0,
    expires: new Date(0),
  });
}

/** Expire the admin session cookie on the outgoing response. */
export function clearAdminSessionCookieOnResponse(res: NextResponse) {
  res.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...sessionCookieBase(),
    maxAge: 0,
    expires: new Date(0),
  });
}

export function attachAccountBundleCookie(
  res: NextResponse,
  bundleId: string
) {
  res.cookies.set(ACCOUNT_BUNDLE_COOKIE, bundleId, {
    ...sessionCookieBase(),
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
  });
}

export async function getOrCreateAccountBundleId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(ACCOUNT_BUNDLE_COOKIE)?.value?.trim();
  if (existing) return existing;
  return randomUUID().replace(/-/g, "");
}

export async function linkAccountToBundle(bundleId: string, userId: string): Promise<void> {
  await ensureColumns();
  await getDb()
    .insert(browserAccountLinks)
    .values({ bundleId, userId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [browserAccountLinks.bundleId, browserAccountLinks.userId],
      set: { updatedAt: new Date() },
    });
}

/** Remove the session row for the raw cookie token (if present). */
export async function deleteSessionRowByRawToken(
  rawToken: string | undefined
): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);
  await getDb().delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export type AuthContext = {
  user: typeof users.$inferSelect;
  session: typeof sessions.$inferSelect;
};

function sessionIsExpired(expiresAt: Date | string | null | undefined): boolean {
  if (expiresAt == null) return true;
  const t =
    expiresAt instanceof Date
      ? expiresAt.getTime()
      : new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return true;
  return t <= Date.now();
}

async function queryAuthContext(tokenHash: string): Promise<AuthContext | null> {
  const rows = await getDb()
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  if (rows.length === 0) return null;
  const { user, session } = rows[0];
  if (sessionIsExpired(session.expiresAt)) return null;

  if (user.isSuspended || user.deletedAt) {
    await getDb().delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }
  try {
    const settings = await getAdminSystemSettings();
    if (settings.maintenance.enabled && !user.isAdmin) {
      return null;
    }
  } catch {
    // ignore settings read failure for auth context
  }

  const now = new Date();
  const stale =
    !session.lastUsedAt ||
    now.getTime() - session.lastUsedAt.getTime() > LAST_USED_TOUCH_MS;
  if (stale) {
    await getDb()
      .update(sessions)
      .set({ lastUsedAt: now })
      .where(eq(sessions.id, session.id));
    session.lastUsedAt = now;
  }

  return { user, session };
}

export async function getAuthContext(): Promise<AuthContext | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const tokenHash = hashSessionToken(token);

    try {
      // Ensure the auth-selected columns exist before selecting Drizzle's full table shapes.
      await ensureColumns();
      return await queryAuthContext(tokenHash);
    } catch (err) {
      // PostgreSQL error 42703 = "undefined_column".
      // This happens when the production DB is missing newly added columns.
      // Run the migration inline and retry once.
      const code = (unwrapDbError(err) as PgErrorLike)?.code;
      if (code === "42703") {
        console.warn("[session] Undefined column detected — running inline migration and retrying.");
        _migrationRan = false;
        await ensureColumns();
        return await queryAuthContext(tokenHash);
      }
      throw err;
    }
  } catch (err) {
    // Don't crash the page on DB errors — treat as unauthenticated.
    logDbError("getAuthContext error", err);
    return null;
  }
}

export async function getCurrentUser() {
  const ctx = await getAuthContext();
  return ctx?.user ?? null;
}

export async function getAdminAuthContext(): Promise<AuthContext | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    if (!token) return null;
    const tokenHash = hashSessionToken(token);

    try {
      await ensureColumns();
      const ctx = await queryAuthContext(tokenHash);
      if (!ctx?.user?.isAdmin) return null;
      return ctx;
    } catch (err) {
      const code = (unwrapDbError(err) as PgErrorLike)?.code;
      if (code === "42703") {
        _migrationRan = false;
        await ensureColumns();
        const ctx = await queryAuthContext(tokenHash);
        if (!ctx?.user?.isAdmin) return null;
        return ctx;
      }
      throw err;
    }
  } catch (err) {
    logDbError("getAdminAuthContext error", err);
    return null;
  }
}

export async function getCurrentAdmin() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return null;
  return user;
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw new Error("Admin authentication required");
  }
  return admin;
}
