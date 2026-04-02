import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/session";
import {
  getAdminSystemSettings,
  updateAdminSystemSettingsSection,
} from "@/lib/admin-system-settings";
import { recordAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

const generalSchema = z.object({
  appName: z.string().min(1).max(120),
  supportEmail: z.email().max(320),
  defaultTimezone: z.string().min(1).max(64),
});

const emailSchema = z.object({
  defaultSenderEmail: z.email().max(320),
  defaultSendingDomain: z.string().min(3).max(255),
  maxEmailSizeBytes: z.number().int().min(1024).max(100 * 1024 * 1024),
  maxAttachmentSizeBytes: z.number().int().min(1024).max(50 * 1024 * 1024),
});

const limitsSchema = z.object({
  maxEmailsPerDayPerUser: z.number().int().min(1).max(100_000),
  maxApiRequestsPerDayPerUser: z.number().int().min(1).max(1_000_000),
  maxDomainsPerUser: z.number().int().min(1).max(1000),
  maxInboxSizeBytes: z.number().int().min(1024 * 1024).max(10 * 1024 * 1024 * 1024),
});

const storageSchema = z.object({
  totalStorageLimitBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  perUserStorageLimitBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  warningThresholdPercent: z.number().int().min(1).max(99),
});

const securitySchema = z.object({
  minPasswordLength: z.number().int().min(8).max(128),
  maxLoginAttempts: z.number().int().min(1).max(1000),
  sessionTimeoutMinutes: z.number().int().min(5).max(60 * 24 * 365),
});

const featuresSchema = z.object({
  signupEnabled: z.boolean(),
  aiEnabled: z.boolean(),
  tempInboxEnabled: z.boolean(),
});

const maintenanceSchema = z.object({
  enabled: z.boolean(),
  message: z.string().min(1).max(500),
});

const cleanupSchema = z.object({
  autoDeleteTrashDays: z.number().int().min(1).max(3650),
});

const patchSchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("general"), values: generalSchema }),
  z.object({ section: z.literal("email"), values: emailSchema }),
  z.object({ section: z.literal("limits"), values: limitsSchema }),
  z.object({ section: z.literal("storage"), values: storageSchema }),
  z.object({ section: z.literal("security"), values: securitySchema }),
  z.object({ section: z.literal("features"), values: featuresSchema }),
  z.object({ section: z.literal("maintenance"), values: maintenanceSchema }),
  z.object({ section: z.literal("cleanupRules"), values: cleanupSchema }),
]);

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getAdminSystemSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const updated = await updateAdminSystemSettingsSection(parsed.data.section, parsed.data.values);
  await recordAdminActivity({
    eventType: "admin_settings_updated",
    severity: "info",
    actorUserId: admin.id,
    detail: `Updated settings section: ${parsed.data.section}`,
    meta: { section: parsed.data.section },
  });
  return NextResponse.json({ ok: true, settings: updated });
}
