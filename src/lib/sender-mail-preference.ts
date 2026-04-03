import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  senderMailPreferences,
  type SenderMailPreference,
} from "@/db/schema";
import { matchesSenderPattern, parsePrimaryEmail } from "@/lib/mail-filter";

function normalizePattern(fromAddr: string): string {
  return parsePrimaryEmail(fromAddr);
}

/** First matching row wins (user should not have overlapping patterns). */
export async function getSenderMailPreferenceForFrom(
  userId: string,
  fromAddr: string
): Promise<SenderMailPreference | null> {
  const rows = await getDb()
    .select({ pattern: senderMailPreferences.pattern, preference: senderMailPreferences.preference })
    .from(senderMailPreferences)
    .where(eq(senderMailPreferences.userId, userId));

  for (const r of rows) {
    if (matchesSenderPattern(fromAddr, r.pattern)) {
      return r.preference;
    }
  }
  return null;
}

export async function upsertSenderMailPreference(params: {
  userId: string;
  fromAddr: string;
  preference: SenderMailPreference;
}): Promise<void> {
  const pattern = normalizePattern(params.fromAddr);
  if (!pattern.includes("@")) return;

  await getDb()
    .insert(senderMailPreferences)
    .values({
      userId: params.userId,
      pattern,
      preference: params.preference,
    })
    .onConflictDoUpdate({
      target: [senderMailPreferences.userId, senderMailPreferences.pattern],
      set: { preference: params.preference },
    });
}

export async function removeSenderMailPreferenceForFrom(
  userId: string,
  fromAddr: string
): Promise<void> {
  const pattern = normalizePattern(fromAddr);
  await getDb()
    .delete(senderMailPreferences)
    .where(
      and(
        eq(senderMailPreferences.userId, userId),
        eq(senderMailPreferences.pattern, pattern)
      )
    );
}
