import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, workspaceMembers, workspaces, type WorkspaceRole } from "@/db/schema";
import { recordUserAudit } from "@/lib/user-audit";
import { getAuthContext } from "@/lib/session";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  localPart: z.string().min(1).max(64),
  role: z.enum(["admin", "member", "viewer"]),
});

async function assertWorkspaceAdmin(
  workspaceId: string,
  actorUserId: string
): Promise<{ inboxOwnerUserId: string } | null> {
  const [ws] = await getDb()
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!ws) return null;
  if (ws.inboxOwnerUserId === actorUserId) {
    return { inboxOwnerUserId: ws.inboxOwnerUserId };
  }
  const [m] = await getDb()
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, actorUserId),
        eq(workspaceMembers.role, "admin")
      )
    )
    .limit(1);
  if (!m) return null;
  return { inboxOwnerUserId: ws.inboxOwnerUserId };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: workspaceId } = await context.params;
  const gate = await assertWorkspaceAdmin(workspaceId, ctx.user.id);
  if (!gate) {
    const member = await getDb()
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, ctx.user.id)
        )
      )
      .limit(1);
    if (member.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  const rows = await getDb()
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
      localPart: users.localPart,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId));
  return NextResponse.json({ members: rows });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: workspaceId } = await context.params;
  const gate = await assertWorkspaceAdmin(workspaceId, ctx.user.id);
  if (!gate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [target] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.localPart, parsed.data.localPart.trim().toLowerCase()))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target.id === gate.inboxOwnerUserId) {
    return NextResponse.json({ error: "Owner is already in workspace" }, { status: 400 });
  }

  const role = parsed.data.role as WorkspaceRole;
  const existing = await getDb()
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, target.id)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    await getDb()
      .update(workspaceMembers)
      .set({ role, joinedAt: new Date() })
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, target.id)
        )
      );
  } else {
    await getDb().insert(workspaceMembers).values({
      workspaceId,
      userId: target.id,
      role,
    });
  }

  await recordUserAudit({
    userId: ctx.user.id,
    action: "workspace_member_add",
    resourceType: "workspace",
    resourceId: workspaceId,
    meta: { memberUserId: target.id, role },
  });

  return NextResponse.json({ ok: true });
}
