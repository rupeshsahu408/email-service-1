import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { domains, mailboxes, professionalProfiles } from "@/db/schema";
import { formatUserEmail } from "@/lib/constants";
import { resolveSendFromForUser } from "@/lib/mail-from";
import { getCurrentUser } from "@/lib/session";

/** Mailboxes + resolved default From preview for compose UI. Optional `?mailboxId=` for selected row preview. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Professional is intentionally disabled.
  const PROFESSIONAL_DISABLED = true;

  const url = new URL(request.url);
  const mailboxIdParam = url.searchParams.get("mailboxId");
  const mailboxId =
    mailboxIdParam && mailboxIdParam.length > 0 ? mailboxIdParam : null;

  const db = getDb();
  const domainRows = await db
    .select({ id: domains.id })
    .from(domains)
    .where(eq(domains.ownerUserId, user.id));
  const domainIds = domainRows.map((d) => d.id);

  let boxRows: (typeof mailboxes.$inferSelect)[] = [];
  if (domainIds.length > 0) {
    boxRows = await db
      .select()
      .from(mailboxes)
      .where(inArray(mailboxes.domainId, domainIds))
      .orderBy(desc(mailboxes.isDefaultSender), desc(mailboxes.createdAt));
  }

  const defaultResolved = await resolveSendFromForUser({
    user,
    mailboxId: null,
  });
  const pro = await db
    .select()
    .from(professionalProfiles)
    .where(eq(professionalProfiles.userId, user.id))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const selectedResolved = mailboxId
    ? await resolveSendFromForUser({ user, mailboxId })
    : defaultResolved;

  return NextResponse.json({
    defaultFrom: defaultResolved.from,
    defaultReplyTo: defaultResolved.replyTo,
    previewFrom: selectedResolved.from,
    previewReplyTo: selectedResolved.replyTo,
    freeAddress: formatUserEmail(user.localPart),
    mailboxes: boxRows.map((m) => ({
      id: m.id,
      emailAddress: m.emailAddress,
      active: m.active,
      isDefaultSender: m.isDefaultSender,
    })).concat(
      !PROFESSIONAL_DISABLED && pro
        ? [
            {
              id: `pro:${user.id}`,
              emailAddress: pro.emailAddress,
              active: true,
              isDefaultSender: false,
            },
          ]
        : []
    ),
  });
}
