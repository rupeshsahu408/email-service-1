import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import { recordUserAudit } from "@/lib/user-audit";
import { getAuthContext } from "@/lib/session";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  name: z.string().max(128).optional(),
});

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownedRaw = await getDb()
    .select()
    .from(workspaces)
    .where(eq(workspaces.inboxOwnerUserId, ctx.user.id));
  const owned = ownedRaw.map((w) => ({
    id: w.id,
    name: w.name,
    inboxOwnerUserId: w.inboxOwnerUserId,
    role: "admin" as const,
  }));

  const member = await getDb()
    .select({
      id: workspaces.id,
      name: workspaces.name,
      inboxOwnerUserId: workspaces.inboxOwnerUserId,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaceMembers.userId, ctx.user.id),
        ne(workspaces.inboxOwnerUserId, ctx.user.id)
      )
    );

  return NextResponse.json({
    workspaces: [...owned, ...member],
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [ws] = await getDb()
    .insert(workspaces)
    .values({
      name: parsed.data.name?.trim() ?? "Team inbox",
      inboxOwnerUserId: ctx.user.id,
    })
    .returning();

  await getDb().insert(workspaceMembers).values({
    workspaceId: ws.id,
    userId: ctx.user.id,
    role: "admin",
  });

  await recordUserAudit({
    userId: ctx.user.id,
    action: "workspace_create",
    resourceType: "workspace",
    resourceId: ws.id,
  });

  return NextResponse.json({ workspace: ws });
}
