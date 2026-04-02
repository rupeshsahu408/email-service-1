/**
 * Shared postgres.js options for Neon and other cloud Postgres.
 *
 * - Neon pooler hostnames contain `-pooler.` — fine for short-lived app traffic; use
 *   `DATABASE_URL_UNPOOLED` (or `DATABASE_URL_DIRECT`) for long DDL / drizzle-kit migrate
 *   so connections hit the compute endpoint directly (Neon recommends this for migrations).
 * - `prepare: false` on pooler URLs avoids transaction-pooling limitations with prepared statements.
 * - `connect_timeout`: bootstrapping a cold or waking Neon branch can exceed 15s; bootstrap uses 60s.
 *
 * Deploy-time migrations (`npm run db:migrate` in CI) avoid competing with app cold starts; set
 * `SKIP_STARTUP_DB_BOOTSTRAP=1` when the baseline schema is applied in the pipeline.
 */

export function isLikelyLocalPostgresUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local")
    );
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

/** Prefer direct Neon URL for DDL / instrumentation when set (see Neon dashboard → Connection details). */
export function getBootstrapDatabaseUrl(): string | undefined {
  const fromEnv =
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL_DIRECT?.trim() ||
    process.env.DATABASE_URL_NON_POOLING?.trim();
  return fromEnv || process.env.DATABASE_URL?.trim() || undefined;
}

export type PostgresJsPurpose = "app" | "bootstrap";

export function postgresJsOptions(
  connectionString: string,
  purpose: PostgresJsPurpose
): {
  max: number;
  idle_timeout: number;
  connect_timeout: number;
  ssl: false | "require";
  prepare?: boolean;
} {
  const local = isLikelyLocalPostgresUrl(connectionString);
  const pooler = connectionString.includes("-pooler.");
  return {
    max: purpose === "bootstrap" ? 1 : 10,
    idle_timeout: purpose === "bootstrap" ? 10 : 20,
    connect_timeout: purpose === "bootstrap" ? 60 : 20,
    ssl: local ? false : "require",
    ...(pooler ? { prepare: false } : {}),
  };
}
