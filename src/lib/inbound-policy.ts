import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { blockedSenders, mailFilterRules } from "@/db/schema";
import { matchesSenderPattern } from "@/lib/mail-filter";

export async function isSenderBlocked(
  userId: string,
  fromAddr: string
): Promise<boolean> {
  const rows = await getDb()
    .select({ email: blockedSenders.email })
    .from(blockedSenders)
    .where(eq(blockedSenders.userId, userId));
  return rows.some((r) => matchesSenderPattern(fromAddr, r.email));
}

export type InboundDisposition =
  | { kind: "inbox" }
  | { kind: "trash" }
  | { kind: "label"; labelId: string };

export async function getInboundDisposition(
  userId: string,
  fromAddr: string
): Promise<InboundDisposition> {
  const rules = await getDb()
    .select()
    .from(mailFilterRules)
    .where(eq(mailFilterRules.userId, userId))
    .orderBy(desc(mailFilterRules.createdAt));
  for (const r of rules) {
    if (!matchesSenderPattern(fromAddr, r.fromMatch)) continue;
    if (r.action === "trash") return { kind: "trash" };
    if (r.action === "label" && r.labelId) {
      return { kind: "label", labelId: r.labelId };
    }
  }
  return { kind: "inbox" };
}
