import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { domains, mailboxes } from "@/db/schema";
import { requireBusinessPlan } from "@/lib/plan";
import { getAuthContext } from "@/lib/session";

const patchSchema = z.object({
  active: z.boolean().optional(),
  isDefaultSender: z.boolean().optional(),
  displayNameOverride: z.string().max(256).nullable().optional(),
});

async function mailboxOwnedByUser(mailboxId: string, userId: string) {
  const db = getDb();
  const row = await db
    .select({ mailbox: mailboxes, domain: domains })
    .from(mailboxes)
    .innerJoin(domains, eq(mailboxes.domainId, domains.id))
    .where(
      and(eq(mailboxes.id, mailboxId), eq(domains.ownerUserId, userId))
    )
    .limit(1);
  return row[0] ?? null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const gate = requireBusinessPlan(ctx.user);
  if (gate !== true) {
    return NextResponse.json(
      { error: gate.error, code: gate.code },
      { status: gate.status }
    );
  }

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const owned = await mailboxOwnedByUser(id, ctx.user.id);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();
  const now = new Date();
  const userDomainRows = await db
    .select({ id: domains.id })
    .from(domains)
    .where(eq(domains.ownerUserId, ctx.user.id));
  const allDomainIds = userDomainRows.map((d) => d.id);

  if (parsed.data.isDefaultSender) {
    if (allDomainIds.length > 0) {
      await db
        .update(mailboxes)
        .set({ isDefaultSender: false, updatedAt: now })
        .where(inArray(mailboxes.domainId, allDomainIds));
    }
  }

  const updates: Partial<typeof mailboxes.$inferInsert> = { updatedAt: now };
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;
  if (parsed.data.isDefaultSender !== undefined) {
    updates.isDefaultSender = parsed.data.isDefaultSender;
  }
  if (parsed.data.displayNameOverride !== undefined) {
    updates.displayNameOverride = parsed.data.displayNameOverride;
  }

  await db.update(mailboxes).set(updates).where(eq(mailboxes.id, id));

  const updated = await db.select().from(mailboxes).where(eq(mailboxes.id, id)).limit(1);
  return NextResponse.json({ mailbox: updated[0] });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const gate = requireBusinessPlan(ctx.user);
  if (gate !== true) {
    return NextResponse.json(
      { error: gate.error, code: gate.code },
      { status: gate.status }
    );
  }

  const { id } = await context.params;
  const owned = await mailboxOwnedByUser(id, ctx.user.id);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await getDb().delete(mailboxes).where(eq(mailboxes.id, id));
  return NextResponse.json({ ok: true });
}
