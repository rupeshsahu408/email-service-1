import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";

export const defaultUserSettings = {
  theme: "system",
  accentHex: "#5b4dff",
  conversationView: true,
  unreadFirst: false,
  inboxDensity: "comfortable" as const,
  signatureHtml: "",
  composeFont: "system",
  draftAutoSave: true,
  blockTrackers: true,
  readReceiptsOutgoing: false,
  externalImages: "ask" as const,
  notificationsEnabled: false,
};

export async function ensureUserSettingsRow(userId: string) {
  const existing = await getDb()
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  if (existing.length > 0) return existing[0];
  const [row] = await getDb()
    .insert(userSettings)
    .values({ userId })
    .returning();
  return row!;
}
