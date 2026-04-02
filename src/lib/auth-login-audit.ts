import { getDb } from "@/db";
import {
  authLoginEvents,
  type AuthLoginContext,
  type AuthLoginMethod,
  type AuthLoginOutcome,
} from "@/db/schema";
import { logError } from "@/lib/logger";
import { getClientIp } from "@/lib/rate-limit";

export type RecordAuthLoginEventInput = {
  outcome: AuthLoginOutcome;
  authMethod: AuthLoginMethod;
  context: AuthLoginContext;
  userId?: string | null;
  identifier: string;
  failureCode?: string | null;
  headers: Headers;
};

function normalizeIdentifier(raw: string): string {
  const t = raw.trim().toLowerCase();
  return t.length > 320 ? t.slice(0, 320) : t;
}

function lookupGeo(ip: string | undefined): {
  geoCountry: string | null;
  geoCity: string | null;
} {
  if (!ip || process.env.GEOIP_DISABLED === "1") {
    return { geoCountry: null, geoCity: null };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const geoip = require("geoip-lite") as {
      lookup: (ip: string) => {
        country?: string;
        city?: string;
        region?: string;
      } | null;
    };
    const hit = geoip.lookup(ip);
    if (!hit) return { geoCountry: null, geoCity: null };
    const city =
      typeof hit.city === "string" && hit.city.length > 0
        ? hit.city
        : typeof hit.region === "string" && hit.region.length > 0
          ? hit.region
          : null;
    return {
      geoCountry: hit.country ?? null,
      geoCity: city,
    };
  } catch {
    return { geoCountry: null, geoCity: null };
  }
}

/**
 * Append-only login audit row. Never throws; logs on failure.
 */
export async function recordAuthLoginEvent(
  input: RecordAuthLoginEventInput
): Promise<void> {
  try {
    const ua = input.headers.get("user-agent") ?? undefined;
    const ipHint = getClientIp(input.headers) ?? undefined;
    const { geoCountry, geoCity } = lookupGeo(ipHint);

    await getDb().insert(authLoginEvents).values({
      outcome: input.outcome,
      authMethod: input.authMethod,
      context: input.context,
      userId: input.userId ?? null,
      identifier: normalizeIdentifier(input.identifier),
      failureCode: input.failureCode?.trim() || null,
      ipHint: ipHint ?? null,
      userAgent: ua ?? null,
      geoCountry,
      geoCity,
    });
  } catch (e) {
    logError("auth_login_event_insert_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
  }
}
