import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export type AdminSystemSettings = {
  general: {
    appName: string;
    supportEmail: string;
    defaultTimezone: string;
  };
  email: {
    defaultSenderEmail: string;
    defaultSendingDomain: string;
    maxEmailSizeBytes: number;
    maxAttachmentSizeBytes: number;
  };
  limits: {
    maxEmailsPerDayPerUser: number;
    maxApiRequestsPerDayPerUser: number;
    maxDomainsPerUser: number;
    maxInboxSizeBytes: number;
  };
  storage: {
    totalStorageLimitBytes: number;
    perUserStorageLimitBytes: number;
    warningThresholdPercent: number;
  };
  security: {
    minPasswordLength: number;
    maxLoginAttempts: number;
    sessionTimeoutMinutes: number;
  };
  features: {
    signupEnabled: boolean;
    aiEnabled: boolean;
    tempInboxEnabled: boolean;
  };
  maintenance: {
    enabled: boolean;
    message: string;
  };
  cleanupRules: {
    autoDeleteTrashDays: number;
  };
};

type SettingsSection = keyof AdminSystemSettings;

const DEFAULT_SETTINGS: AdminSystemSettings = {
  general: {
    appName: "Sendora",
    supportEmail: "support@sendora.com",
    defaultTimezone: "UTC",
  },
  email: {
    defaultSenderEmail: "noreply@sendora.com",
    defaultSendingDomain: "sendora.com",
    maxEmailSizeBytes: 10 * 1024 * 1024,
    maxAttachmentSizeBytes: 5 * 1024 * 1024,
  },
  limits: {
    maxEmailsPerDayPerUser: 300,
    maxApiRequestsPerDayPerUser: 5000,
    maxDomainsPerUser: 10,
    maxInboxSizeBytes: 5 * 1024 * 1024 * 1024,
  },
  storage: {
    totalStorageLimitBytes: 0,
    perUserStorageLimitBytes: 0,
    warningThresholdPercent: 80,
  },
  security: {
    minPasswordLength: 12,
    maxLoginAttempts: 10,
    sessionTimeoutMinutes: 60 * 24 * 30,
  },
  features: {
    signupEnabled: true,
    aiEnabled: true,
    tempInboxEnabled: true,
  },
  maintenance: {
    enabled: false,
    message: "Scheduled maintenance in progress. Please try again later.",
  },
  cleanupRules: {
    autoDeleteTrashDays: 30,
  },
};

let ensured = false;
let cached: { at: number; value: AdminSystemSettings } | null = null;
const CACHE_MS = 10_000;

function normalizeSettings(input: unknown): AdminSystemSettings {
  if (!input || typeof input !== "object") return DEFAULT_SETTINGS;
  const raw = input as Partial<AdminSystemSettings>;
  return {
    general: {
      appName: raw.general?.appName?.trim() || DEFAULT_SETTINGS.general.appName,
      supportEmail: raw.general?.supportEmail?.trim() || DEFAULT_SETTINGS.general.supportEmail,
      defaultTimezone:
        raw.general?.defaultTimezone?.trim() || DEFAULT_SETTINGS.general.defaultTimezone,
    },
    email: {
      defaultSenderEmail:
        raw.email?.defaultSenderEmail?.trim() || DEFAULT_SETTINGS.email.defaultSenderEmail,
      defaultSendingDomain:
        raw.email?.defaultSendingDomain?.trim() || DEFAULT_SETTINGS.email.defaultSendingDomain,
      maxEmailSizeBytes: Math.max(
        1,
        Number(raw.email?.maxEmailSizeBytes ?? DEFAULT_SETTINGS.email.maxEmailSizeBytes)
      ),
      maxAttachmentSizeBytes: Math.max(
        1,
        Number(
          raw.email?.maxAttachmentSizeBytes ?? DEFAULT_SETTINGS.email.maxAttachmentSizeBytes
        )
      ),
    },
    limits: {
      maxEmailsPerDayPerUser: Math.max(
        1,
        Number(raw.limits?.maxEmailsPerDayPerUser ?? DEFAULT_SETTINGS.limits.maxEmailsPerDayPerUser)
      ),
      maxApiRequestsPerDayPerUser: Math.max(
        1,
        Number(
          raw.limits?.maxApiRequestsPerDayPerUser ?? DEFAULT_SETTINGS.limits.maxApiRequestsPerDayPerUser
        )
      ),
      maxDomainsPerUser: Math.max(
        1,
        Number(raw.limits?.maxDomainsPerUser ?? DEFAULT_SETTINGS.limits.maxDomainsPerUser)
      ),
      maxInboxSizeBytes: Math.max(
        1,
        Number(raw.limits?.maxInboxSizeBytes ?? DEFAULT_SETTINGS.limits.maxInboxSizeBytes)
      ),
    },
    storage: {
      totalStorageLimitBytes: Math.max(
        0,
        Number(raw.storage?.totalStorageLimitBytes ?? DEFAULT_SETTINGS.storage.totalStorageLimitBytes)
      ),
      perUserStorageLimitBytes: Math.max(
        0,
        Number(raw.storage?.perUserStorageLimitBytes ?? DEFAULT_SETTINGS.storage.perUserStorageLimitBytes)
      ),
      warningThresholdPercent: Math.min(
        99,
        Math.max(
          1,
          Number(raw.storage?.warningThresholdPercent ?? DEFAULT_SETTINGS.storage.warningThresholdPercent)
        )
      ),
    },
    security: {
      minPasswordLength: Math.max(
        8,
        Number(raw.security?.minPasswordLength ?? DEFAULT_SETTINGS.security.minPasswordLength)
      ),
      maxLoginAttempts: Math.max(
        1,
        Number(raw.security?.maxLoginAttempts ?? DEFAULT_SETTINGS.security.maxLoginAttempts)
      ),
      sessionTimeoutMinutes: Math.max(
        5,
        Number(raw.security?.sessionTimeoutMinutes ?? DEFAULT_SETTINGS.security.sessionTimeoutMinutes)
      ),
    },
    features: {
      signupEnabled: Boolean(raw.features?.signupEnabled ?? DEFAULT_SETTINGS.features.signupEnabled),
      aiEnabled: Boolean(raw.features?.aiEnabled ?? DEFAULT_SETTINGS.features.aiEnabled),
      tempInboxEnabled: Boolean(
        raw.features?.tempInboxEnabled ?? DEFAULT_SETTINGS.features.tempInboxEnabled
      ),
    },
    maintenance: {
      enabled: Boolean(raw.maintenance?.enabled ?? DEFAULT_SETTINGS.maintenance.enabled),
      message: raw.maintenance?.message?.trim() || DEFAULT_SETTINGS.maintenance.message,
    },
    cleanupRules: {
      autoDeleteTrashDays: Math.max(
        1,
        Number(raw.cleanupRules?.autoDeleteTrashDays ?? DEFAULT_SETTINGS.cleanupRules.autoDeleteTrashDays)
      ),
    },
  };
}

export async function ensureAdminSystemSettingsTable(): Promise<void> {
  if (ensured) return;
  await getDb().execute(sql`
    create table if not exists admin_system_settings (
      id integer primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);
  await getDb().execute(sql`
    insert into admin_system_settings(id, data, updated_at)
    values (1, ${JSON.stringify(DEFAULT_SETTINGS)}::jsonb, now())
    on conflict (id) do nothing
  `);
  ensured = true;
}

export async function getAdminSystemSettings(options?: {
  bypassCache?: boolean;
}): Promise<AdminSystemSettings> {
  if (!options?.bypassCache && cached && Date.now() - cached.at < CACHE_MS) {
    return cached.value;
  }
  await ensureAdminSystemSettingsTable();
  const rows = await getDb().execute(sql`
    select data
    from admin_system_settings
    where id = 1
    limit 1
  `);
  const row = (rows as unknown as Array<Record<string, unknown>>)[0];
  const settings = normalizeSettings(row?.data);
  cached = { at: Date.now(), value: settings };
  return settings;
}

export async function updateAdminSystemSettingsSection<K extends SettingsSection>(
  section: K,
  patch: Partial<AdminSystemSettings[K]>
): Promise<AdminSystemSettings> {
  const current = await getAdminSystemSettings({ bypassCache: true });
  const next = normalizeSettings({
    ...current,
    [section]: {
      ...(current[section] as object),
      ...(patch as object),
    },
  });
  await ensureAdminSystemSettingsTable();
  await getDb().execute(sql`
    update admin_system_settings
    set data = ${JSON.stringify(next)}::jsonb,
        updated_at = now()
    where id = 1
  `);
  cached = { at: Date.now(), value: next };
  return next;
}

export function defaultAdminSystemSettings(): AdminSystemSettings {
  return DEFAULT_SETTINGS;
}
