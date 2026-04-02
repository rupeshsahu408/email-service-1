import { createHash } from "crypto";
import { getUpstashRedis } from "@/lib/rate-limit";

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const r = getUpstashRedis();
  if (!r) return null;
  const raw = await r.get(key);
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(
  key: string,
  value: unknown,
  ttlSec: number
): Promise<void> {
  const r = getUpstashRedis();
  if (!r) return;
  await r.set(key, JSON.stringify(value), { ex: ttlSec });
}

export function shortHashKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}
