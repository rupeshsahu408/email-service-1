import { randomUUID } from "crypto";
import { getDb } from "@/db";
import { domainActivityLogs } from "@/db/schema";

export type DomainActivityActorType = "system" | "admin" | "user";

export async function recordDomainActivity(input: {
  domainId: string;
  eventType: string;
  actorType: DomainActivityActorType;
  actorUserId?: string | null;
  detail?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await getDb().insert(domainActivityLogs).values({
      id: randomUUID(),
      domainId: input.domainId,
      eventType: input.eventType.slice(0, 64),
      actorType: input.actorType.slice(0, 16),
      actorUserId: input.actorUserId ?? null,
      detail: input.detail ?? null,
      meta: input.meta ?? null,
      createdAt: new Date(),
    });
  } catch {
    // Non-critical
  }
}
