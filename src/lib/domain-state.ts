import { and, desc, eq } from "drizzle-orm";
import type { DomainDnsCheckStatus } from "@/db/schema";
import { domainDiagnostics, domainDnsChecks, domains } from "@/db/schema";
import { getDb } from "@/db";
import { runDomainDnsChecks } from "@/lib/domain-dns-check-service";
import { recordDomainActivity } from "@/lib/domain-activity";

function technicalSendingOk(checks: { checkType: string; status: DomainDnsCheckStatus }[]): boolean {
  for (const c of checks) {
    if (c.status === "pass") continue;
    if (c.checkType === "dmarc" && c.status === "warning") continue;
    return false;
  }
  return true;
}

export type RunDomainDnsPipelineResult = {
  checks: Awaited<ReturnType<typeof runDomainDnsChecks>>["checks"];
  health: Awaited<ReturnType<typeof runDomainDnsChecks>>["health"];
  issues: Awaited<ReturnType<typeof runDomainDnsChecks>>["issues"];
};

/**
 * Runs live DNS checks, persists rows, applies auto operational/sending rules.
 * Does not override admin suspension (operational stays suspended until unsuspended).
 */
export async function runDomainDnsPipeline(
  domainId: string,
  opts?: { actorUserId?: string | null; actorType?: "system" | "admin" | "user" }
): Promise<RunDomainDnsPipelineResult> {
  const db = getDb();
  const rows = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new Error("Domain not found");
  }

  const { checks, issues, health } = await runDomainDnsChecks({
    domainName: row.domainName,
    verificationToken: row.verificationToken,
    dkimSelector: row.dkimSelector,
  });

  const now = new Date();

  await db.delete(domainDnsChecks).where(eq(domainDnsChecks.domainId, domainId));
  await db.insert(domainDnsChecks).values(
    checks.map((c) => ({
      domainId,
      checkType: c.checkType,
      status: c.status,
      expectedSummary: c.expectedSummary,
      observedRaw: c.observedRaw,
      checkedAt: now,
      errorMessage: c.errorMessage ?? null,
    }))
  );

  await db.insert(domainDiagnostics).values({
    domainId,
    issues,
    health,
    computedAt: now,
  });

  const verificationOk =
    checks.find((c) => c.checkType === "verification_txt")?.status === "pass";
  const sendOk = technicalSendingOk(
    checks.map((c) => ({ checkType: c.checkType, status: c.status }))
  );

  let nextVerificationStatus = row.verificationStatus;
  let verifiedAt = row.verifiedAt;
  if (verificationOk && row.verificationStatus !== "verified") {
    nextVerificationStatus = "verified";
    verifiedAt = now;
    await recordDomainActivity({
      domainId,
      eventType: "domain_verified",
      actorType: "system",
      detail: "Verification TXT matched on DNS recheck.",
    });
  }

  const wasSuspended = row.operationalStatus === "suspended";

  let nextOperational = row.operationalStatus;
  let lastAutoActivatedAt = row.lastAutoActivatedAt;
  let lastAutoSendingEnabledAt = row.lastAutoSendingEnabledAt;

  if (!wasSuspended) {
    if (verificationOk && health !== "unhealthy") {
      if (row.operationalStatus !== "active") {
        nextOperational = "active";
        lastAutoActivatedAt = now;
        await recordDomainActivity({
          domainId,
          eventType: "auto_activated",
          actorType: "system",
          detail: "Domain met verification and health requirements.",
          meta: { health },
        });
      } else {
        nextOperational = "active";
      }
    } else if (row.operationalStatus === "active") {
      nextOperational = "pending";
    }
  }

  let sendingEnabled = row.sendingEnabled;
  let sendingDisabledSource = row.sendingDisabledSource;
  let sendingDisabledAt = row.sendingDisabledAt;
  let sendingDisabledBy = row.sendingDisabledBy;
  let sendingDisableReason = row.sendingDisableReason;

  const adminLocked = row.sendingDisabledSource === "admin" && !row.sendingEnabled;

  if (wasSuspended) {
    sendingEnabled = false;
    sendingDisabledSource = "system";
    sendingDisableReason = "Domain is suspended by an administrator.";
    sendingDisabledAt = now;
    sendingDisabledBy = null;
  } else if (nextOperational !== "active" || !sendOk) {
    if (!adminLocked) {
      const wasSending = row.sendingEnabled && row.sendingDisabledSource !== "admin";
      sendingEnabled = false;
      sendingDisabledSource = "system";
      sendingDisableReason =
        nextOperational !== "active"
          ? "Domain is not active or verification/health failed."
          : "DNS or policy checks failed for sending.";
      sendingDisabledAt = now;
      sendingDisabledBy = null;
      if (wasSending) {
        await recordDomainActivity({
          domainId,
          eventType: "sending_disabled_system",
          actorType: "system",
          detail: sendingDisableReason,
          meta: { health },
        });
      }
    }
  } else {
    if (!adminLocked) {
      const prev = row.sendingEnabled;
      sendingEnabled = true;
      sendingDisabledSource = null;
      sendingDisableReason = null;
      sendingDisabledAt = null;
      sendingDisabledBy = null;
      if (!prev && row.sendingDisabledSource !== "admin") {
        lastAutoSendingEnabledAt = now;
        await recordDomainActivity({
          domainId,
          eventType: "auto_sending_enabled",
          actorType: "system",
          detail: "Sending enabled after successful checks.",
          meta: { health },
        });
      }
    }
  }

  await db
    .update(domains)
    .set({
      verificationStatus: nextVerificationStatus,
      verifiedAt,
      failureReason:
        nextVerificationStatus === "verified" ? null : row.failureReason,
      lastCheckAt: now,
      updatedAt: now,
      operationalStatus: nextOperational,
      lastAutoActivatedAt,
      lastAutoSendingEnabledAt,
      sendingEnabled,
      sendingDisabledSource,
      sendingDisabledAt,
      sendingDisabledBy,
      sendingDisableReason,
    })
    .where(eq(domains.id, domainId));

  return { checks, health, issues };
}

/** Latest diagnostics row for a domain (most recent computed_at). */
export async function getLatestDomainDiagnostics(domainId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(domainDiagnostics)
    .where(eq(domainDiagnostics.domainId, domainId))
    .orderBy(desc(domainDiagnostics.computedAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Latest check per type (after pipeline, all rows share same checked_at). */
export async function getLatestDomainDnsChecks(domainId: string) {
  const db = getDb();
  return db
    .select()
    .from(domainDnsChecks)
    .where(eq(domainDnsChecks.domainId, domainId))
    .orderBy(desc(domainDnsChecks.checkedAt));
}
