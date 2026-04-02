import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workspaceMembers, workspaces, type WorkspaceRole } from "@/db/schema";

export type MailboxAccess =
  | { kind: "owner"; inboxOwnerUserId: string }
  | { kind: "workspace"; inboxOwnerUserId: string; role: WorkspaceRole };

export async function tryResolveMailboxAccess(
  readerUserId: string,
  requestedInboxOwnerId: string | null | undefined
): Promise<MailboxAccess | null> {
  const target = (requestedInboxOwnerId?.trim() || readerUserId) as string;
  if (target === readerUserId) {
    return { kind: "owner", inboxOwnerUserId: readerUserId };
  }
  const row = await getDb()
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaceMembers.userId, readerUserId),
        eq(workspaces.inboxOwnerUserId, target)
      )
    )
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!row) return null;
  return { kind: "workspace", inboxOwnerUserId: target, role: row.role };
}

export function canReadInbox(access: MailboxAccess): boolean {
  return true;
}

export function canMutateInbox(access: MailboxAccess): boolean {
  if (access.kind === "owner") return true;
  return access.role === "admin" || access.role === "member";
}

export function canAssignInbox(access: MailboxAccess): boolean {
  if (access.kind === "owner") return true;
  return access.role === "admin" || access.role === "member";
}

/** Viewers may not load team analytics for the shared inbox. */
export function canViewTeamAnalytics(access: MailboxAccess): boolean {
  if (access.kind === "owner") return true;
  return access.role === "admin" || access.role === "member";
}

export async function listSharedInboxesForUser(memberUserId: string): Promise<
  { workspaceId: string; name: string; inboxOwnerUserId: string; role: WorkspaceRole }[]
> {
  return getDb()
    .select({
      workspaceId: workspaces.id,
      name: workspaces.name,
      inboxOwnerUserId: workspaces.inboxOwnerUserId,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, memberUserId));
}

/** Team member (or owner) allowed as assignee for shared inbox messages. */
export async function isUserAssignableInWorkspace(
  inboxOwnerUserId: string,
  candidateUserId: string
): Promise<boolean> {
  if (candidateUserId === inboxOwnerUserId) return true;
  const rows = await getDb()
    .select({ one: workspaceMembers.userId })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaces.inboxOwnerUserId, inboxOwnerUserId),
        eq(workspaceMembers.userId, candidateUserId)
      )
    )
    .limit(1);
  return rows.length > 0;
}
