import type {
  DomainDiagnosticHealth,
  DomainDiagnosticIssue,
  DomainDnsCheckStatus,
  DomainDnsCheckType,
} from "@/db/schema";
import {
  buildDmarcDnsHost,
  buildDkimDnsHost,
  buildExpectedTxtRecord,
  resolveMxWithFallback,
  resolveTxtWithFallback,
  verifyDomainTxtRecord,
  type MxRecord,
} from "@/lib/domain-dns";

export type DnsCheckRowInput = {
  checkType: DomainDnsCheckType;
  status: DomainDnsCheckStatus;
  expectedSummary: string | null;
  observedRaw: Record<string, unknown>;
  errorMessage?: string | null;
};

function getRequiredSpfInclude(): string {
  return (
    process.env.DOMAIN_SPF_REQUIRED_INCLUDE?.trim().toLowerCase() ??
    "include:resend.com"
  );
}

/** Hostnames (lowercase, no trailing dot) — at least one must appear as MX target. */
function getExpectedMxHosts(): string[] {
  const raw =
    process.env.DOMAIN_EXPECTED_MX_HOSTS?.trim() ||
    process.env.RESEND_INBOUND_MX_HOST?.trim() ||
    "inbound.resend.dev";
  return raw
    .split(/[\s,]+/)
    .map((h) => h.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
}

function flattenTxtChunks(chunks: string[][]): string[] {
  const out: string[] = [];
  for (const ch of chunks) {
    for (const part of ch) {
      out.push(part.replace(/^"(.*)"$/, "$1").trim());
    }
  }
  return out;
}

function extractSpfRecords(txtValues: string[]): string[] {
  return txtValues.filter((t) => /^v=spf1\b/i.test(t));
}

function normalizeSpfIncludeRequirement(raw: string): string {
  const t = raw.trim().toLowerCase();
  return t.startsWith("include:") ? t : `include:${t}`;
}

export async function runDomainDnsChecks(params: {
  domainName: string;
  verificationToken: string;
  dkimSelector: string;
}): Promise<{ checks: DnsCheckRowInput[]; issues: DomainDiagnosticIssue[]; health: DomainDiagnosticHealth }> {
  const { domainName, verificationToken, dkimSelector } = params;
  const d = domainName.trim().toLowerCase().replace(/\.$/, "");
  const checks: DnsCheckRowInput[] = [];
  const issues: DomainDiagnosticIssue[] = [];

  // --- Verification TXT ---
  const ver = await verifyDomainTxtRecord(d, verificationToken);
  checks.push({
    checkType: "verification_txt",
    status: ver.ok ? "pass" : "fail",
    expectedSummary: buildExpectedTxtRecord(verificationToken),
    observedRaw: { note: ver.ok ? "matched" : (ver.reason ?? "no match") },
    errorMessage: ver.ok ? null : ver.reason ?? null,
  });
  if (!ver.ok) {
    issues.push({
      code: "verification_pending",
      severity: "blocking",
      message: ver.reason ?? "Domain verification TXT not valid.",
      fix: `Add TXT at _sendora.${d} with value: ${buildExpectedTxtRecord(verificationToken)}`,
    });
  }

  // --- SPF (apex) ---
  const spfInclude = getRequiredSpfInclude();
  const apexTxt = await resolveTxtWithFallback(d, 8000);
  let spfStatus: DomainDnsCheckStatus = "error";
  let spfObserved: Record<string, unknown> = {};
  if (!apexTxt.ok) {
    spfStatus = "error";
    spfObserved = { error: apexTxt.error };
    issues.push({
      code: "spf_dns_error",
      severity: "blocking",
      message: apexTxt.error,
      fix: "Check DNS resolver connectivity or set DNS_VERIFY_SERVERS.",
    });
  } else {
    const flat = flattenTxtChunks(apexTxt.records);
    const spfs = extractSpfRecords(flat);
    spfObserved = { txtRecords: flat, spfRecords: spfs };
    if (spfs.length === 0) {
      spfStatus = "fail";
      issues.push({
        code: "spf_missing",
        severity: "blocking",
        message: "No SPF (TXT starting with v=spf1) found at the domain apex.",
        fix: `Add a TXT record at ${d} including ${spfInclude} for Resend outbound.`,
      });
    } else if (spfs.length > 1) {
      spfStatus = "fail";
      issues.push({
        code: "spf_multiple",
        severity: "blocking",
        message: "Multiple SPF TXT records found; only one is allowed.",
        fix: "Merge into a single SPF record at the apex.",
      });
    } else {
      const one = spfs[0]!;
      const need = normalizeSpfIncludeRequirement(spfInclude);
      if (one.toLowerCase().includes(need)) {
        spfStatus = "pass";
      } else {
        spfStatus = "fail";
        issues.push({
          code: "spf_invalid",
          severity: "blocking",
          message: `SPF must authorize sending (expected ${need} for Resend).`,
          fix: `Update SPF to include ${need} (or set DOMAIN_SPF_REQUIRED_INCLUDE).`,
        });
      }
    }
  }
  checks.push({
    checkType: "spf",
    status: spfStatus,
    expectedSummary: `SPF including ${spfInclude}`,
    observedRaw: spfObserved,
    errorMessage: !apexTxt.ok ? apexTxt.error : null,
  });

  // --- DKIM ---
  const dkimHost = buildDkimDnsHost(d, dkimSelector);
  const dkimTxt = await resolveTxtWithFallback(dkimHost, 8000);
  let dkimStatus: DomainDnsCheckStatus = "error";
  let dkimObserved: Record<string, unknown> = {};
  if (!dkimTxt.ok) {
    dkimStatus = "error";
    dkimObserved = { host: dkimHost, error: dkimTxt.error };
    issues.push({
      code: "dkim_dns_error",
      severity: "blocking",
      message: dkimTxt.error,
      fix: "Fix DNS resolution or add the DKIM record from your sending provider.",
    });
  } else {
    const flat = flattenTxtChunks(dkimTxt.records);
    dkimObserved = { host: dkimHost, txt: flat };
    const joined = flat.join("").toLowerCase();
    const looksDkim =
      joined.includes("v=dkim1") ||
      joined.includes("p=") ||
      /k=rsa|k=ed25519/i.test(joined);
    if (flat.length === 0) {
      dkimStatus = "fail";
      issues.push({
        code: "dkim_missing",
        severity: "blocking",
        message: `No DKIM record at ${dkimHost}.`,
        fix: "Add the DKIM TXT/CNAME record from Resend (or your ESP) for this domain.",
      });
    } else if (!looksDkim) {
      dkimStatus = "fail";
      issues.push({
        code: "dkim_invalid",
        severity: "blocking",
        message: "DKIM record present but does not look like a valid DKIM key record.",
        fix: "Replace with the exact DKIM record from your mail provider.",
      });
    } else {
      dkimStatus = "pass";
    }
  }
  checks.push({
    checkType: "dkim",
    status: dkimStatus,
    expectedSummary: `TXT at ${dkimHost} (selector ${dkimSelector})`,
    observedRaw: dkimObserved,
    errorMessage: !dkimTxt.ok ? dkimTxt.error : null,
  });

  // --- DMARC ---
  const dmarcHost = buildDmarcDnsHost(d);
  const dmarcTxt = await resolveTxtWithFallback(dmarcHost, 8000);
  let dmarcStatus: DomainDnsCheckStatus = "error";
  let dmarcObserved: Record<string, unknown> = {};
  if (!dmarcTxt.ok) {
    dmarcStatus = "error";
    dmarcObserved = { error: dmarcTxt.error };
    issues.push({
      code: "dmarc_dns_error",
      severity: "blocking",
      message: dmarcTxt.error,
      fix: "Fix DNS resolution for DMARC.",
    });
  } else {
    const flat = flattenTxtChunks(dmarcTxt.records);
    const joined = flat.join("").trim();
    dmarcObserved = { host: dmarcHost, record: joined || null };
    if (!joined) {
      dmarcStatus = "fail";
      issues.push({
        code: "dmarc_missing",
        severity: "blocking",
        message: "No DMARC record at _dmarc.",
        fix: `Add TXT at _dmarc.${d} e.g. v=DMARC1; p=none; rua=mailto:dmarc@${d}`,
      });
    } else if (!/^v=DMARC1\b/i.test(joined)) {
      dmarcStatus = "fail";
      issues.push({
        code: "dmarc_invalid",
        severity: "blocking",
        message: "DMARC TXT found but does not start with v=DMARC1.",
        fix: "Use a valid DMARC record format.",
      });
    } else {
      const pMatch = joined.match(/;\s*p=([^;]+)/i);
      const p = pMatch?.[1]?.trim().toLowerCase();
      if (p === "none") {
        dmarcStatus = "warning";
        issues.push({
          code: "dmarc_weak_policy",
          severity: "warning",
          message: "DMARC policy is p=none (monitoring only).",
          fix: "Move to p=quarantine or p=reject when ready.",
        });
      } else {
        dmarcStatus = "pass";
      }
    }
  }
  checks.push({
    checkType: "dmarc",
    status: dmarcStatus,
    expectedSummary: `TXT at ${dmarcHost}`,
    observedRaw: dmarcObserved,
    errorMessage: !dmarcTxt.ok ? dmarcTxt.error : null,
  });

  // --- MX (inbound alignment) ---
  const expectedMx = getExpectedMxHosts();
  const mxRes = await resolveMxWithFallback(d, 8000);
  let mxStatus: DomainDnsCheckStatus = "error";
  let mxObserved: Record<string, unknown> = {};
  if (!mxRes.ok) {
    mxStatus = "error";
    mxObserved = { error: mxRes.error };
    issues.push({
      code: "mx_dns_error",
      severity: "blocking",
      message: mxRes.error,
      fix: "Fix DNS resolution for MX.",
    });
  } else {
    const list = mxRes.records;
    mxObserved = { mx: list, expectedHosts: expectedMx };
    const targets = new Set(list.map((r) => r.exchange.toLowerCase()));
    const hit = expectedMx.some((h) => targets.has(h));
    if (list.length === 0) {
      mxStatus = "fail";
      issues.push({
        code: "mx_missing",
        severity: "blocking",
        message: "No MX records found for the domain.",
        fix: `Add MX pointing to ${expectedMx.join(" or ")} (inbound).`,
      });
    } else if (!hit) {
      mxStatus = "fail";
      issues.push({
        code: "mx_mismatch",
        severity: "blocking",
        message: `MX does not include expected inbound host (${expectedMx.join(", ")}).`,
        fix: "Point MX to your configured inbound mail host (e.g. Resend inbound).",
      });
    } else {
      mxStatus = "pass";
    }
  }
  checks.push({
    checkType: "mx",
    status: mxStatus,
    expectedSummary: `MX includes ${expectedMx.join(", ")}`,
    observedRaw: mxObserved,
    errorMessage: !mxRes.ok ? mxRes.error : null,
  });

  // --- Health ---
  const blocking = issues.filter((i) => i.severity === "blocking");
  const warnings = issues.filter((i) => i.severity === "warning");
  let health: DomainDiagnosticHealth;
  if (blocking.length > 0) {
    health = "unhealthy";
  } else if (warnings.length > 0 || checks.some((c) => c.status === "warning")) {
    health = "degraded";
  } else {
    health = "healthy";
  }

  return { checks, issues, health };
}

export function mxRecordsForExport(records: MxRecord[]): unknown {
  return records.map((r) => ({ exchange: r.exchange, priority: r.priority }));
}
