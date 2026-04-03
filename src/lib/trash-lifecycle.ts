import { and, eq, lte, or, sql } from "drizzle-orm";
import { messages } from "@/db/schema";
import type { DbClient } from "@/lib/storage-quota";
import { getAdminSystemSettings } from "@/lib/admin-system-settings";

export const TRASH_RETENTION_DAYS = 30;
export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function getTrashDeleteAfterAt(from: Date): Date {
  return new Date(from.getTime() + TRASH_RETENTION_MS);
}

export function getTrashLifecyclePatch(now = new Date()): {
  folder: "trash";
  trashMovedAt: Date;
  trashDeleteAfterAt: Date;
} {
  return {
    folder: "trash",
    trashMovedAt: now,
    trashDeleteAfterAt: getTrashDeleteAfterAt(now),
  };
}

export function getRestoreFromTrashPatch(): {
  trashMovedAt: null;
  trashDeleteAfterAt: null;
} {
  return {
    trashMovedAt: null,
    trashDeleteAfterAt: null,
  };
}

export async function deleteExpiredTrashMessages(
  db: DbClient,
  userId?: string
): Promise<number> {
  const now = new Date();
  let retentionDays = TRASH_RETENTION_DAYS;
  try {
    const settings = await getAdminSystemSettings();
    retentionDays = Math.max(1, settings.cleanupRules.autoDeleteTrashDays);
  } catch {
    retentionDays = TRASH_RETENTION_DAYS;
  }
  const dynamicCutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const whereBase = and(
    eq(messages.folder, "trash"),
    or(
      lte(messages.trashDeleteAfterAt, now),
      lte(messages.trashMovedAt, dynamicCutoff)
    )
  );
  if (!whereBase) return 0;
  const whereClause = userId
    ? and(whereBase, eq(messages.userId, userId))
    : whereBase;
  if (!whereClause) return 0;
  const rows = await db
    .delete(messages)
    .where(whereClause)
    .returning({ id: messages.id });
  return rows.length;
}

export async function countExpiredTrashMessages(db: DbClient): Promise<number> {
  const now = new Date();
  let retentionDays = TRASH_RETENTION_DAYS;
  try {
    const settings = await getAdminSystemSettings();
    retentionDays = Math.max(1, settings.cleanupRules.autoDeleteTrashDays);
  } catch {
    retentionDays = TRASH_RETENTION_DAYS;
  }
  const dynamicCutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      n: sql<number>`count(*)::int`,
    })
    .from(messages)
    .where(
      and(
        eq(messages.folder, "trash"),
        or(
          lte(messages.trashDeleteAfterAt, now),
          lte(messages.trashMovedAt, dynamicCutoff)
        )
      )
    );
  return Number(rows[0]?.n ?? 0);
}
