import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { getAdminSystemSettings } from "@/lib/admin-system-settings";

let ensured = false;

async function ensureApiUsageTable(): Promise<void> {
  if (ensured) return;
  await getDb().execute(sql`
    create table if not exists api_usage_daily (
      user_id uuid not null,
      day_utc date not null,
      request_count integer not null default 0,
      updated_at timestamptz not null default now(),
      primary key (user_id, day_utc)
    )
  `);
  ensured = true;
}

export async function enforceApiUsageLimitForUser(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
}> {
  const settings = await getAdminSystemSettings();
  const limit = settings.limits.maxApiRequestsPerDayPerUser;
  await ensureApiUsageTable();

  const day = new Date().toISOString().slice(0, 10);
  const rows = await getDb().execute(sql`
    insert into api_usage_daily(user_id, day_utc, request_count, updated_at)
    values (${userId}::uuid, ${day}::date, 1, now())
    on conflict (user_id, day_utc)
    do update set
      request_count = api_usage_daily.request_count + 1,
      updated_at = now()
    returning request_count
  `);
  const count = Number((rows as unknown as Array<Record<string, unknown>>)[0]?.request_count ?? 0);
  return {
    allowed: count <= limit,
    remaining: Math.max(limit - count, 0),
  };
}
