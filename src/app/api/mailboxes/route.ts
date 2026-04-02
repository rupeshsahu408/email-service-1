import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { domains, mailboxes } from "@/db/schema";
import { requireBusinessPlan } from "@/lib/plan";
import { getAuthContext } from "@/lib/session";

const LOCAL_RE = /^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$/i;

const postSchema = z.object({
  domainId: z.string().uuid(),
  localPart: z.string().min(1).max(64),
  displayNameOverride: z.string().max(256).optional(),
  isDefaultSender: z.boolean().optional(),
});

export async function GET() {
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

  const db = getDb();
  const domainIds = await db
    .select({ id: domains.id })
    .from(domains)
    .where(eq(domains.ownerUserId, ctx.user.id));
  const ids = domainIds.map((d) => d.id);
  if (ids.length === 0) {
    return NextResponse.json({ mailboxes: [] });
  }

  const rows = await db
    .select({
      mailbox: mailboxes,
      domainName: domains.domainName,
      domainVerified: domains.verificationStatus,
    })
    .from(mailboxes)
    .innerJoin(domains, eq(mailboxes.domainId, domains.id))
    .where(inArray(mailboxes.domainId, ids))
    .orderBy(desc(mailboxes.createdAt));

  return NextResponse.json({
    mailboxes: rows.map((r) => ({
      ...r.mailbox,
      domainName: r.domainName,
      domainVerified: r.domainVerified === "verified",
    })),
  });
}

export async function POST(request: NextRequest) {
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

  const lp = parsed.data.localPart.trim().toLowerCase();
  if (!LOCAL_RE.test(lp)) {
    return NextResponse.json({ error: "Invalid local part" }, { status: 400 });
  }

  const db = getDb();
  const dom = await db
    .select()
    .from(domains)
    .where(
      and(
        eq(domains.id, parsed.data.domainId),
        eq(domains.ownerUserId, ctx.user.id)
      )
    )
    .limit(1);

  if (dom.length === 0) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }
  if (
    dom[0]!.verificationStatus !== "verified" ||
    dom[0]!.operationalStatus !== "active"
  ) {
    return NextResponse.json(
      {
        error:
          "Domain must be verified and active (DNS checks passed) before adding mailboxes",
      },
      { status: 400 }
    );
  }

  const domainName = dom[0]!.domainName;
  const emailAddress = `${lp}@${domainName}`.toLowerCase();
  const now = new Date();

  const countRow = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(mailboxes)
    .innerJoin(domains, eq(mailboxes.domainId, domains.id))
    .where(eq(domains.ownerUserId, ctx.user.id));
  const isFirstMailbox = Number(countRow[0]?.n ?? 0) === 0;
  const makeDefault =
    isFirstMailbox || Boolean(parsed.data.isDefaultSender);

  const userDomainRows = await db
    .select({ id: domains.id })
    .from(domains)
    .where(eq(domains.ownerUserId, ctx.user.id));
  const allDomainIds = userDomainRows.map((d) => d.id);

  try {
    if (makeDefault) {
      if (allDomainIds.length > 0) {
        await db
          .update(mailboxes)
          .set({ isDefaultSender: false, updatedAt: now })
          .where(inArray(mailboxes.domainId, allDomainIds));
      }
    }

    const [row] = await db
      .insert(mailboxes)
      .values({
        domainId: parsed.data.domainId,
        localPart: lp,
        emailAddress,
        displayNameOverride: parsed.data.displayNameOverride?.trim() || null,
        active: true,
        isDefaultSender: makeDefault,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({ mailbox: row });
  } catch {
    return NextResponse.json(
      { error: "Mailbox may already exist" },
      { status: 409 }
    );
  }
}
