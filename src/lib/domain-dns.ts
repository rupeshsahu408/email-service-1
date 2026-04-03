import { randomBytes } from "crypto";
import { Resolver } from "node:dns/promises";
import type { DnsRecordRow } from "@/db/schema";

/**
 * Public resolvers for TXT checks — avoids ECONNREFUSED from broken OS/VPN/Docker stub DNS.
 * Override with DNS_VERIFY_SERVERS="8.8.8.8,1.1.1.1" (comma or space separated).
 */
function getVerifyDnsServers(): string[] {
  const raw = process.env.DNS_VERIFY_SERVERS?.trim();
  if (raw) {
    return raw.split(/[\s,]+/).filter(Boolean);
  }
  return ["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"];
}

function isLikelyLocalResolverFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|timeout/i.test(msg);
}

/**
 * Google DNS JSON API (HTTPS) — works when outbound UDP/53 to resolvers is blocked
 * but HTTPS to the internet is allowed (common on strict hosts).
 */
async function resolveTxtViaGoogleDnsJson(host: string): Promise<string[][]> {
  const u = new URL("https://dns.google/resolve");
  u.searchParams.set("name", host);
  u.searchParams.set("type", "TXT");
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12_000);
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      headers: { accept: "application/dns-json" },
      signal: ac.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`DNS over HTTPS failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    Status: number;
    Answer?: { type: number; data: string }[];
  };
  if (json.Status === 3) {
    return [];
  }
  if (json.Status !== 0) {
    throw new Error(`DNS over HTTPS: response status ${json.Status}`);
  }
  const chunks: string[][] = [];
  for (const a of json.Answer ?? []) {
    if (a.type !== 16) continue;
    let data = a.data.trim();
    if (data.startsWith('"') && data.endsWith('"')) {
      data = data.slice(1, -1).replace(/\\"/g, '"');
    }
    chunks.push([data]);
  }
  return chunks;
}

async function resolveTxtPublic(
  host: string,
  timeoutMs: number
): Promise<string[][]> {
  const servers = getVerifyDnsServers();
  const resolver = new Resolver();
  resolver.setServers(servers);
  return await Promise.race([
    resolver.resolveTxt(host),
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("DNS timeout")), timeoutMs)
    ),
  ]);
}

/** Exported for SPF/DKIM/DMARC checks (same resolvers + DoH fallback as verification TXT). */
export async function resolveTxtWithFallback(
  host: string,
  timeoutMs = 8000
): Promise<{ ok: true; records: string[][] } | { ok: false; error: string }> {
  try {
    const records = await resolveTxtPublic(host, timeoutMs);
    return { ok: true, records };
  } catch (e) {
    if (isLikelyLocalResolverFailure(e)) {
      try {
        const records = await resolveTxtViaGoogleDnsJson(host);
        return { ok: true, records };
      } catch (e2) {
        const m1 = e instanceof Error ? e.message : String(e);
        const m2 = e2 instanceof Error ? e2.message : String(e2);
        return {
          ok: false,
          error: `DNS lookup failed (${m1}). HTTPS fallback: ${m2}`,
        };
      }
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "DNS lookup failed",
    };
  }
}

export type MxRecord = { exchange: string; priority: number };

async function resolveMxPublic(
  name: string,
  timeoutMs: number
): Promise<MxRecord[]> {
  const servers = getVerifyDnsServers();
  const resolver = new Resolver();
  resolver.setServers(servers);
  const rows = await Promise.race([
    resolver.resolveMx(name),
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("DNS timeout")), timeoutMs)
    ),
  ]);
  return rows.map((r) => ({
    exchange: r.exchange.replace(/\.$/, "").toLowerCase(),
    priority: r.priority,
  }));
}

async function resolveMxViaGoogleDnsJson(name: string): Promise<MxRecord[]> {
  const u = new URL("https://dns.google/resolve");
  u.searchParams.set("name", name);
  u.searchParams.set("type", "MX");
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12_000);
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      headers: { accept: "application/dns-json" },
      signal: ac.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`DNS over HTTPS failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    Status: number;
    Answer?: { type: number; data: string }[];
  };
  if (json.Status === 3) {
    return [];
  }
  if (json.Status !== 0) {
    throw new Error(`DNS over HTTPS: response status ${json.Status}`);
  }
  const out: MxRecord[] = [];
  for (const a of json.Answer ?? []) {
    if (a.type !== 15) continue;
    const parts = a.data.trim().split(/\s+/);
    const priority = Number(parts[0]);
    const exchange = parts.slice(1).join(" ").replace(/\.$/, "").toLowerCase();
    if (exchange) {
      out.push({ priority: Number.isFinite(priority) ? priority : 0, exchange });
    }
  }
  return out;
}

export async function resolveMxWithFallback(
  name: string,
  timeoutMs = 8000
): Promise<{ ok: true; records: MxRecord[] } | { ok: false; error: string }> {
  const d = name.trim().toLowerCase().replace(/\.$/, "");
  try {
    const records = await resolveMxPublic(d, timeoutMs);
    return { ok: true, records };
  } catch (e) {
    if (isLikelyLocalResolverFailure(e)) {
      try {
        const records = await resolveMxViaGoogleDnsJson(d);
        return { ok: true, records };
      } catch (e2) {
        const m1 = e instanceof Error ? e.message : String(e);
        const m2 = e2 instanceof Error ? e2.message : String(e2);
        return {
          ok: false,
          error: `MX lookup failed (${m1}). HTTPS fallback: ${m2}`,
        };
      }
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "MX lookup failed",
    };
  }
}

export function buildDkimDnsHost(domainName: string, selector: string): string {
  const d = domainName.trim().toLowerCase().replace(/\.$/, "");
  const s = selector.trim().toLowerCase();
  return `${s}._domainkey.${d}`;
}

export function buildDmarcDnsHost(domainName: string): string {
  const d = domainName.trim().toLowerCase().replace(/\.$/, "");
  return `_dmarc.${d}`;
}

const VERIFY_HOST = "_sendora";

export function buildVerificationHost(domainName: string): string {
  const d = domainName.trim().toLowerCase().replace(/\.$/, "");
  return `${VERIFY_HOST}.${d}`;
}

/**
 * Token we ask the user to put in TXT at _sendora.domain.tld
 */
export function generateVerificationToken(): string {
  return randomBytes(16).toString("hex");
}

export function buildExpectedTxtRecord(token: string): string {
  return `sendora-verify=${token}`;
}

export type DnsRecordsForUi = {
  records: DnsRecordRow[];
  verificationHost: string;
  verificationTxt: string;
};

/**
 * Required DNS rows for UI (MX points to receiving; TXT for our verification).
 * SPF/DKIM values are placeholders — operators complete in Resend dashboard.
 */
export function buildDnsInstructionRecords(
  domainName: string,
  token: string
): DnsRecordsForUi {
  const d = domainName.trim().toLowerCase().replace(/\.$/, "");
  const host = buildVerificationHost(d);
  const txt = buildExpectedTxtRecord(token);
  const inboundHint =
    process.env.RESEND_INBOUND_MX_HOST ?? "inbound.resend.dev";

  const records: DnsRecordRow[] = [
    {
      type: "TXT",
      name: host,
      value: txt,
      purpose: "Prove you control this domain (Sendora verification)",
    },
    {
      type: "MX",
      name: d,
      value: `10 ${inboundHint}`,
      purpose: "Receive email (point to your mail provider — e.g. Resend inbound)",
    },
    {
      type: "TXT",
      name: d,
      value: `v=spf1 include:resend.com ~all`,
      purpose: "SPF — adjust per your sending provider",
    },
  ];

  return {
    records,
    verificationHost: host,
    verificationTxt: txt,
  };
}

function txtMatchesExpected(records: string[][], expected: string): boolean {
  const norm = expected.trim().toLowerCase();
  for (const chunk of records) {
    for (const r of chunk) {
      const s = r.replace(/^"(.*)"$/, "$1").trim().toLowerCase();
      if (s === norm || s.includes(norm)) return true;
    }
  }
  return false;
}

export async function verifyDomainTxtRecord(
  domainName: string,
  token: string,
  timeoutMs = 8000
): Promise<{ ok: boolean; reason?: string }> {
  const host = buildVerificationHost(domainName);
  const expected = buildExpectedTxtRecord(token);

  let result: string[][] | undefined;
  try {
    result = await resolveTxtPublic(host, timeoutMs);
  } catch (e) {
    if (isLikelyLocalResolverFailure(e)) {
      try {
        result = await resolveTxtViaGoogleDnsJson(host);
      } catch (e2) {
        const m1 = e instanceof Error ? e.message : String(e);
        const m2 = e2 instanceof Error ? e2.message : String(e2);
        return {
          ok: false,
          reason: `DNS lookup failed (${m1}). HTTPS DNS fallback failed (${m2}). If the server blocks DNS, set DNS_VERIFY_SERVERS or allow HTTPS to dns.google.`,
        };
      }
    } else {
      return {
        ok: false,
        reason: e instanceof Error ? e.message : "DNS lookup failed",
      };
    }
  }

  if (!result || result.length === 0) {
    return {
      ok: false,
      reason:
        "TXT record not found yet. Add the _sendora TXT at your DNS provider, wait for propagation (often 5–30 minutes), then verify again.",
    };
  }

  if (txtMatchesExpected(result, expected)) {
    return { ok: true };
  }

  return {
    ok: false,
    reason:
      "TXT record found but value does not match. Copy the exact sendora-verify=… value from Sendora DNS instructions.",
  };
}
