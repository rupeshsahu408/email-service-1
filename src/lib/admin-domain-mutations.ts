import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { domains } from "@/db/schema";
import { recordAdminActivity } from "@/lib/admin-activity";
import { recordDomainActivity } from "@/lib/domain-activity";
import { runDomainDnsPipeline } from "@/lib/domain-state";

export async function adminSuspendDomain(input: {
  domainId: string;
  actorUserId: string;
  reason?: string | null;
}): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .update(domains)
    .set({
      operationalStatus: "suspended",
      suspendedAt: now,
      suspendedBy: input.actorUserId,
      suspensionReason: input.reason ?? null,
      sendingEnabled: false,
      sendingDisabledSource: "system",
      sendingDisableReason: input.reason ?? "Domain suspended by administrator.",
      sendingDisabledAt: now,
      sendingDisabledBy: null,
      updatedAt: now,
    })
    .where(eq(domains.id, input.domainId));

  await recordDomainActivity({
    domainId: input.domainId,
    eventType: "domain_suspended",
    actorType: "admin",
    actorUserId: input.actorUserId,
    detail: input.reason ?? "Domain suspended",
  });
  await recordAdminActivity({
    eventType: "domain_suspended",
    severity: "warning",
    actorUserId: input.actorUserId,
    detail: `Domain suspended`,
    meta: { domainId: input.domainId, reason: input.reason },
  });
}

export async function adminUnsuspendDomain(input: {
  domainId: string;
  actorUserId: string;
}): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .update(domains)
    .set({
      operationalStatus: "pending",
      suspendedAt: null,
      suspendedBy: null,
      suspensionReason: null,
      updatedAt: now,
    })
    .where(eq(domains.id, input.domainId));

  await recordDomainActivity({
    domainId: input.domainId,
    eventType: "domain_unsuspended",
    actorType: "admin",
    actorUserId: input.actorUserId,
    detail: "Suspension cleared; DNS pipeline will re-evaluate.",
  });
  await recordAdminActivity({
    eventType: "domain_unsuspended",
    severity: "info",
    actorUserId: input.actorUserId,
    detail: `Domain unsuspended`,
    meta: { domainId: input.domainId },
  });

  await runDomainDnsPipeline(input.domainId, {
    actorUserId: input.actorUserId,
    actorType: "admin",
  });
}

export async function adminDisableDomainSending(input: {
  domainId: string;
  actorUserId: string;
  reason?: string | null;
}): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .update(domains)
    .set({
      sendingEnabled: false,
      sendingDisabledSource: "admin",
      sendingDisabledAt: now,
      sendingDisabledBy: input.actorUserId,
      sendingDisableReason: input.reason ?? "Sending disabled by administrator.",
      updatedAt: now,
    })
    .where(eq(domains.id, input.domainId));

  await recordDomainActivity({
    domainId: input.domainId,
    eventType: "sending_disabled_admin",
    actorType: "admin",
    actorUserId: input.actorUserId,
    detail: input.reason ?? "Sending disabled",
  });
  await recordAdminActivity({
    eventType: "domain_sending_disabled",
    severity: "warning",
    actorUserId: input.actorUserId,
    detail: `Domain sending disabled`,
    meta: { domainId: input.domainId, reason: input.reason },
  });
}

export async function adminEnableDomainSending(input: {
  domainId: string;
  actorUserId: string;
}): Promise<void> {
  const db = getDb();
  const now = new Date();
  await db
    .update(domains)
    .set({
      sendingDisabledSource: null,
      sendingDisabledAt: null,
      sendingDisabledBy: null,
      sendingDisableReason: null,
      updatedAt: now,
    })
    .where(eq(domains.id, input.domainId));

  await recordDomainActivity({
    domainId: input.domainId,
    eventType: "sending_enabled_admin",
    actorType: "admin",
    actorUserId: input.actorUserId,
    detail: "Admin cleared sending lock; pipeline will apply technical rules.",
  });
  await recordAdminActivity({
    eventType: "domain_sending_enabled",
    severity: "info",
    actorUserId: input.actorUserId,
    detail: `Domain sending enabled by admin`,
    meta: { domainId: input.domainId },
  });

  await runDomainDnsPipeline(input.domainId, {
    actorUserId: input.actorUserId,
    actorType: "admin",
  });
}
