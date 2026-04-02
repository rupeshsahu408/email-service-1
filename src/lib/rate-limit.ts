import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logWarn } from "./logger";

const memoryBuckets = new Map<
  string,
  { count: number; resetAt: number }
>();

function memoryLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean } {
  const now = Date.now();
  const b = memoryBuckets.get(key);
  if (!b || now > b.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true };
  }
  if (b.count < limit) {
    b.count += 1;
    return { success: true };
  }
  return { success: false };
}

let signupRatelimit: Ratelimit | null = null;
let sendRatelimit: Ratelimit | null = null;
let aiWriteRatelimit: Ratelimit | null = null;
let aiInlineRatelimit: Ratelimit | null = null;
let recoveryVerifyRatelimit: Ratelimit | null = null;
let recoverySupportRatelimit: Ratelimit | null = null;
let recoveryResetRatelimit: Ratelimit | null = null;
let redisSingleton: Redis | null | undefined;

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "").trim();
}

function getRedis(): Redis | null {
  if (redisSingleton !== undefined) return redisSingleton;
  const rawUrl = process.env.UPSTASH_REDIS_REST_URL;
  const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!rawUrl || !rawToken) {
    redisSingleton = null;
    return null;
  }
  const url = stripQuotes(rawUrl);
  const token = stripQuotes(rawToken);
  if (!url.startsWith("https://")) {
    logWarn("upstash_invalid_url", { hint: "UPSTASH_REDIS_REST_URL must start with https://" });
    redisSingleton = null;
    return null;
  }
  redisSingleton = new Redis({ url, token });
  return redisSingleton;
}

function getSignupRatelimit(): Ratelimit | null {
  if (signupRatelimit) return signupRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  signupRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 d"),
    prefix: "rl:signup",
  });
  return signupRatelimit;
}

function getSendRatelimit(): Ratelimit | null {
  if (sendRatelimit) return sendRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  sendRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, "1 h"),
    prefix: "rl:send",
  });
  return sendRatelimit;
}

function getAiWriteRatelimit(): Ratelimit | null {
  if (aiWriteRatelimit) return aiWriteRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  aiWriteRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 h"),
    prefix: "rl:ai_write",
  });
  return aiWriteRatelimit;
}

function getAiInlineRatelimit(): Ratelimit | null {
  if (aiInlineRatelimit) return aiInlineRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  aiInlineRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 h"),
    prefix: "rl:ai_inline",
  });
  return aiInlineRatelimit;
}

function getRecoveryVerifyRatelimit(): Ratelimit | null {
  if (recoveryVerifyRatelimit) return recoveryVerifyRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  recoveryVerifyRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 h"),
    prefix: "rl:recovery_verify",
  });
  return recoveryVerifyRatelimit;
}

function getRecoverySupportRatelimit(): Ratelimit | null {
  if (recoverySupportRatelimit) return recoverySupportRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  recoverySupportRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    prefix: "rl:recovery_support",
  });
  return recoverySupportRatelimit;
}

function getRecoveryResetRatelimit(): Ratelimit | null {
  if (recoveryResetRatelimit) return recoveryResetRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  recoveryResetRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "rl:recovery_reset",
  });
  return recoveryResetRatelimit;
}

export async function rateLimitSignup(ip: string): Promise<{ success: boolean }> {
  const rl = getSignupRatelimit();
  if (rl) {
    return rl.limit(ip);
  }
  logWarn("rate_limit_memory_fallback", { route: "signup" });
  return memoryLimit(`signup:${ip}`, 5, 86_400_000);
}

export async function rateLimitRecoveryVerify(
  ip: string
): Promise<{ success: boolean }> {
  const rl = getRecoveryVerifyRatelimit();
  if (rl) {
    return rl.limit(ip);
  }
  logWarn("rate_limit_memory_fallback", { route: "recovery_verify" });
  return memoryLimit(`recovery_verify:${ip}`, 20, 3_600_000);
}

export async function rateLimitRecoverySupport(
  ip: string
): Promise<{ success: boolean }> {
  return rateLimitRecoverySupportByKey(ip);
}

export async function rateLimitRecoverySupportByKey(
  key: string
): Promise<{ success: boolean }> {
  const rl = getRecoverySupportRatelimit();
  if (rl) {
    return rl.limit(key);
  }
  logWarn("rate_limit_memory_fallback", { route: "recovery_support" });
  return memoryLimit(`recovery_support:${key}`, 5, 3_600_000);
}

export async function rateLimitRecoveryReset(
  ip: string
): Promise<{ success: boolean }> {
  const rl = getRecoveryResetRatelimit();
  if (rl) {
    return rl.limit(ip);
  }
  logWarn("rate_limit_memory_fallback", { route: "recovery_reset" });
  return memoryLimit(`recovery_reset:${ip}`, 10, 3_600_000);
}

export async function rateLimitSend(
  userId: string
): Promise<{ success: boolean }> {
  const rl = getSendRatelimit();
  if (rl) {
    return rl.limit(userId);
  }
  logWarn("rate_limit_memory_fallback", { route: "send" });
  return memoryLimit(`send:${userId}`, 50, 3_600_000);
}

/** Shared Upstash REST client for TTL caches (optional; null if env missing). */
export function getUpstashRedis(): Redis | null {
  return getRedis();
}

export async function rateLimitAiWrite(
  userId: string
): Promise<{ success: boolean }> {
  const rl = getAiWriteRatelimit();
  if (rl) {
    return rl.limit(userId);
  }
  logWarn("rate_limit_memory_fallback", { route: "ai_write" });
  return memoryLimit(`ai_write:${userId}`, 20, 3_600_000);
}

export async function rateLimitAiInline(
  userId: string
): Promise<{ success: boolean }> {
  const rl = getAiInlineRatelimit();
  if (rl) {
    return rl.limit(userId);
  }
  logWarn("rate_limit_memory_fallback", { route: "ai_inline" });
  return memoryLimit(`ai_inline:${userId}`, 60, 3_600_000);
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return headers.get("x-real-ip") ?? "unknown";
}
