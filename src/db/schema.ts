import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  index,
  uniqueIndex,
  primaryKey,
  jsonb,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    localPart: varchar("local_part", { length: 64 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    recoveryKeyHash: text("recovery_key_hash").notNull(),
    passwordResetTokenHash: text("password_reset_token_hash"),
    passwordResetTokenExpiresAt: timestamp("password_reset_token_expires_at", {
      withTimezone: true,
    }),
    passwordResetTokenUsedAt: timestamp("password_reset_token_used_at", {
      withTimezone: true,
    }),
    avatarUrl: text("avatar_url"),
    isAdmin: boolean("is_admin").notNull().default(false),
    isSuspended: boolean("is_suspended").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    plan: varchar("plan", { length: 16 }).notNull().default("free"),
    planStatus: varchar("plan_status", { length: 16 }).notNull().default("free"),
    planExpiresAt: timestamp("plan_expires_at", { withTimezone: true }),
    razorpayOrderId: varchar("razorpay_order_id", { length: 128 }),
    razorpaySubscriptionId: varchar("razorpay_subscription_id", { length: 128 }),
    razorpayPlanId: varchar("razorpay_plan_id", { length: 128 }),
    nextBillingAt: timestamp("next_billing_at", { withTimezone: true }),
    billingPeriodStart: timestamp("billing_period_start", { withTimezone: true }),
    subscriptionAutoRenew: boolean("subscription_auto_renew").notNull().default(true),
    proPlanStatus: varchar("pro_plan_status", { length: 16 })
      .notNull()
      .default("free"),
    proPlanExpiresAt: timestamp("pro_plan_expires_at", { withTimezone: true }),
    proRazorpaySubscriptionId: varchar("pro_razorpay_subscription_id", {
      length: 128,
    }),
    proRazorpayPlanId: varchar("pro_razorpay_plan_id", { length: 128 }),
    proNextBillingAt: timestamp("pro_next_billing_at", { withTimezone: true }),
    proBillingPeriodStart: timestamp("pro_billing_period_start", {
      withTimezone: true,
    }),
    proSubscriptionAutoRenew: boolean("pro_subscription_auto_renew")
      .notNull()
      .default(true),

    /** Temporary Inbox subscription (₹10/week). */
    tempInboxPlanStatus: varchar("temp_inbox_plan_status", { length: 16 })
      .notNull()
      .default("free"),
    tempInboxPlanExpiresAt: timestamp("temp_inbox_plan_expires_at", {
      withTimezone: true,
    }),
    tempRazorpaySubscriptionId: varchar("temp_razorpay_subscription_id", {
      length: 128,
    }),
    tempRazorpayPlanId: varchar("temp_razorpay_plan_id", { length: 128 }),
    tempNextBillingAt: timestamp("temp_next_billing_at", { withTimezone: true }),
    tempSubscriptionAutoRenew: boolean("temp_subscription_auto_renew")
      .notNull()
      .default(true),

    fullName: varchar("full_name", { length: 256 }).notNull().default(""),
    emailVerified: boolean("email_verified").notNull().default(true),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspensionReason: text("suspension_reason"),
    /** Temporary security hold (distinct from operational suspension). */
    securityLockedUntil: timestamp("security_locked_until", {
      withTimezone: true,
    }),
    securityLockReason: text("security_lock_reason"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    storageQuotaBytes: bigint("storage_quota_bytes", { mode: "number" })
      .notNull()
      .default(5_368_709_120),
    adminNotes: text("admin_notes"),
    /** personal | business | professional — display / admin classification */
    accountType: varchar("account_type", { length: 32 }).notNull().default("personal"),
    emailVerificationTokenHash: text("email_verification_token_hash"),
    emailVerificationExpiresAt: timestamp("email_verification_expires_at", {
      withTimezone: true,
    }),
  },
  (t) => [uniqueIndex("users_local_part_unique").on(t.localPart)]
);

export const billingProductTypeEnum = [
  "business_email",
  "temporary_inbox",
  "professional_email",
] as const;
export type BillingProductType = (typeof billingProductTypeEnum)[number];

export const billingIntervalEnum = ["monthly", "yearly", "weekly", "one_time"] as const;
export type BillingInterval = (typeof billingIntervalEnum)[number];

export const billingSubscriptions = pgTable(
  "billing_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productType: varchar("product_type", { length: 32 })
      .notNull()
      .$type<BillingProductType>(),
    interval: varchar("interval", { length: 16 }).notNull().$type<BillingInterval>(),
    provider: varchar("provider", { length: 32 }).notNull().default("razorpay"),
    providerSubscriptionId: varchar("provider_subscription_id", { length: 128 }).notNull(),
    providerPlanId: varchar("provider_plan_id", { length: 128 }),
    status: varchar("status", { length: 32 }).notNull().default("created"),
    autoRenew: boolean("auto_renew").notNull().default(true),
    currentStartAt: timestamp("current_start_at", { withTimezone: true }),
    currentEndAt: timestamp("current_end_at", { withTimezone: true }),
    nextBillingAt: timestamp("next_billing_at", { withTimezone: true }),
    cancelAtCycleEnd: boolean("cancel_at_cycle_end").notNull().default(false),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("billing_subscriptions_provider_sub_unique").on(t.providerSubscriptionId),
    index("billing_subscriptions_user_idx").on(t.userId, t.createdAt),
    index("billing_subscriptions_status_idx").on(t.status, t.nextBillingAt),
    index("billing_subscriptions_product_idx").on(t.productType, t.interval),
  ]
);

export const billingPayments = pgTable(
  "billing_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productType: varchar("product_type", { length: 32 })
      .notNull()
      .$type<BillingProductType>(),
    interval: varchar("interval", { length: 16 }).notNull().$type<BillingInterval>(),
    provider: varchar("provider", { length: 32 }).notNull().default("razorpay"),
    providerPaymentId: varchar("provider_payment_id", { length: 128 }).notNull(),
    providerOrderId: varchar("provider_order_id", { length: 128 }),
    providerSubscriptionId: varchar("provider_subscription_id", { length: 128 }),
    providerPlanId: varchar("provider_plan_id", { length: 128 }),
    amount: integer("amount").notNull().default(0),
    currency: varchar("currency", { length: 16 }).notNull().default("INR"),
    status: varchar("status", { length: 32 }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    failedReason: text("failed_reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("billing_payments_provider_payment_unique").on(t.providerPaymentId),
    index("billing_payments_user_idx").on(t.userId, t.createdAt),
    index("billing_payments_status_idx").on(t.status, t.capturedAt),
    index("billing_payments_product_idx").on(t.productType, t.interval),
    index("billing_payments_subscription_idx").on(t.providerSubscriptionId),
  ]
);

export const adminActivityLogs = pgTable(
  "admin_activity_logs",
  {
    id: uuid("id").primaryKey(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    severity: varchar("severity", { length: 16 }).notNull().default("info"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    subjectUserId: uuid("subject_user_id").references(() => users.id, { onDelete: "set null" }),
    detail: text("detail"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("admin_activity_logs_created_idx").on(t.createdAt),
    index("admin_activity_logs_type_idx").on(t.eventType, t.createdAt),
  ]
);

export const browserAccountLinks = pgTable(
  "browser_account_links",
  {
    bundleId: varchar("bundle_id", { length: 64 }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.bundleId, t.userId], name: "browser_account_links_pk" }),
    index("browser_account_links_bundle_idx").on(t.bundleId),
  ]
);

/** 1:1 business branding for users who use Business features. */
export const businessProfiles = pgTable(
  "business_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    businessName: varchar("business_name", { length: 256 }).notNull().default(""),
    displayNameDefault: varchar("display_name_default", { length: 256 }).notNull().default(""),
    logoUrl: text("logo_url"),
    website: varchar("website", { length: 512 }),
    supportContact: varchar("support_contact", { length: 320 }),
    brandColor: varchar("brand_color", { length: 7 }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }
);

/** 1:1 professional identity for users on Professional plan. */
export const professionalProfiles = pgTable(
  "professional_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    handle: varchar("handle", { length: 32 }).notNull(),
    emailAddress: varchar("email_address", { length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 256 }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("professional_profiles_handle_unique").on(t.handle),
    uniqueIndex("professional_profiles_email_unique").on(t.emailAddress),
  ]
);

/** 1:many temporary inbox aliases (one user's generated address). */
export const tempInboxAliases = pgTable(
  "temp_inbox_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    localPart: varchar("local_part", { length: 64 }).notNull(),
    emailAddress: varchar("email_address", { length: 320 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    expiryMinutes: integer("expiry_minutes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("temp_inbox_alias_email_unique").on(t.emailAddress),
    index("temp_inbox_alias_user_idx").on(t.userId),
    index("temp_inbox_alias_expires_idx").on(t.expiresAt),
  ]
);

/** OTP-focused emails received on a temporary inbox alias. */
export const tempInboxMessages = pgTable(
  "temp_inbox_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    aliasId: uuid("alias_id")
      .notNull()
      .references(() => tempInboxAliases.id, { onDelete: "cascade" }),
    providerMessageId: varchar("provider_message_id", { length: 512 }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    fromAddr: text("from_addr").notNull().default(""),
    subject: text("subject").notNull().default(""),
    otpCode: varchar("otp_code", { length: 16 }),
    otpMatchedAt: timestamp("otp_matched_at", { withTimezone: true }),
    snippet: text("snippet").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("temp_inbox_provider_msg_unique").on(t.userId, t.providerMessageId),
    index("temp_inbox_messages_user_received_idx").on(t.userId, t.receivedAt),
    index("temp_inbox_messages_alias_idx").on(t.aliasId),
  ]
);

/**
 * OTP emails received for a temp inbox address we haven't claimed yet.
 * This enables catch-all routing for any `*@sendora.me` address.
 */
export const tempInboxUnclaimedMessages = pgTable(
  "temp_inbox_unclaimed_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    emailAddress: varchar("email_address", { length: 320 }).notNull(),
    providerMessageId: varchar("provider_message_id", { length: 512 }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    fromAddr: text("from_addr").notNull().default(""),
    subject: text("subject").notNull().default(""),
    otpCode: varchar("otp_code", { length: 16 }),
    otpMatchedAt: timestamp("otp_matched_at", { withTimezone: true }),
    snippet: text("snippet").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("temp_inbox_unclaimed_provider_msg_unique").on(
      t.emailAddress,
      t.providerMessageId
    ),
    index("temp_inbox_unclaimed_email_idx").on(t.emailAddress),
    index("temp_inbox_unclaimed_expires_idx").on(t.expiresAt),
    index("temp_inbox_unclaimed_received_idx").on(t.receivedAt),
  ]
);

export const domainVerificationStatusEnum = [
  "not_connected",
  "dns_pending",
  "verifying",
  "verified",
  "failed",
] as const;
export type DomainVerificationStatus =
  (typeof domainVerificationStatusEnum)[number];

export type DnsRecordRow = {
  type: string;
  name: string;
  value: string;
  purpose: string;
};

export const domainOperationalStatusEnum = [
  "pending",
  "active",
  "suspended",
] as const;
export type DomainOperationalStatus =
  (typeof domainOperationalStatusEnum)[number];

export const domainSendingDisabledSourceEnum = ["system", "admin"] as const;
export type DomainSendingDisabledSource =
  (typeof domainSendingDisabledSourceEnum)[number];

export const domainDnsCheckTypeEnum = [
  "verification_txt",
  "spf",
  "dkim",
  "dmarc",
  "mx",
] as const;
export type DomainDnsCheckType = (typeof domainDnsCheckTypeEnum)[number];

export const domainDnsCheckStatusEnum = [
  "pass",
  "fail",
  "warning",
  "pending",
  "error",
] as const;
export type DomainDnsCheckStatus =
  (typeof domainDnsCheckStatusEnum)[number];

export const domainDiagnosticHealthEnum = [
  "healthy",
  "degraded",
  "unhealthy",
] as const;
export type DomainDiagnosticHealth =
  (typeof domainDiagnosticHealthEnum)[number];

export type DomainDiagnosticIssue = {
  code: string;
  severity: "blocking" | "warning" | "info";
  message: string;
  fix?: string;
};

export const domains = pgTable(
  "domains",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domainName: varchar("domain_name", { length: 255 }).notNull(),
    verificationStatus: varchar("verification_status", { length: 32 })
      .notNull()
      .default("dns_pending")
      .$type<DomainVerificationStatus>(),
    verificationToken: varchar("verification_token", { length: 128 }).notNull(),
    dnsRecordsSnapshot: jsonb("dns_records_snapshot").$type<DnsRecordRow[]>(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    lastCheckAt: timestamp("last_check_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    adminNotes: text("admin_notes"),
    operationalStatus: varchar("operational_status", { length: 32 })
      .notNull()
      .default("pending")
      .$type<DomainOperationalStatus>(),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspendedBy: uuid("suspended_by").references(() => users.id, {
      onDelete: "set null",
    }),
    suspensionReason: text("suspension_reason"),
    sendingEnabled: boolean("sending_enabled").notNull().default(false),
    sendingDisabledAt: timestamp("sending_disabled_at", { withTimezone: true }),
    sendingDisabledBy: uuid("sending_disabled_by").references(() => users.id, {
      onDelete: "set null",
    }),
    sendingDisableReason: text("sending_disable_reason"),
    sendingDisabledSource: varchar("sending_disabled_source", {
      length: 16,
    }).$type<DomainSendingDisabledSource | null>(),
    lastAutoActivatedAt: timestamp("last_auto_activated_at", {
      withTimezone: true,
    }),
    lastAutoSendingEnabledAt: timestamp("last_auto_sending_enabled_at", {
      withTimezone: true,
    }),
    dkimSelector: varchar("dkim_selector", { length: 64 }).notNull().default(
      "resend"
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("domains_domain_name_unique").on(t.domainName),
    index("domains_owner_idx").on(t.ownerUserId),
    index("domains_verification_status_idx").on(t.verificationStatus),
    index("domains_operational_status_idx").on(t.operationalStatus),
    index("domains_sending_enabled_idx").on(t.sendingEnabled),
    index("domains_sending_disabled_source_idx").on(t.sendingDisabledSource),
    index("domains_last_check_idx").on(t.lastCheckAt),
    index("domains_created_idx").on(t.createdAt),
  ]
);

export const domainDnsChecks = pgTable(
  "domain_dns_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    checkType: varchar("check_type", { length: 32 })
      .notNull()
      .$type<DomainDnsCheckType>(),
    status: varchar("status", { length: 16 }).notNull().$type<DomainDnsCheckStatus>(),
    expectedSummary: text("expected_summary"),
    observedRaw: jsonb("observed_raw").$type<Record<string, unknown>>(),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    errorMessage: text("error_message"),
  },
  (t) => [
    index("domain_dns_checks_domain_idx").on(t.domainId, t.checkedAt),
    index("domain_dns_checks_domain_type_idx").on(t.domainId, t.checkType),
  ]
);

export const domainDiagnostics = pgTable(
  "domain_diagnostics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    issues: jsonb("issues").$type<DomainDiagnosticIssue[]>().notNull(),
    health: varchar("health", { length: 16 }).notNull().$type<DomainDiagnosticHealth>(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("domain_diagnostics_domain_idx").on(t.domainId, t.computedAt),
  ]
);

export const domainActivityLogs = pgTable(
  "domain_activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    actorType: varchar("actor_type", { length: 16 }).notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    detail: text("detail"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("domain_activity_logs_domain_created_idx").on(t.domainId, t.createdAt),
    index("domain_activity_logs_event_idx").on(t.eventType, t.createdAt),
  ]
);

export const mailboxes = pgTable(
  "mailboxes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    localPart: varchar("local_part", { length: 64 }).notNull(),
    emailAddress: varchar("email_address", { length: 320 }).notNull(),
    displayNameOverride: varchar("display_name_override", { length: 256 }),
    active: boolean("active").notNull().default(true),
    isDefaultSender: boolean("is_default_sender").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("mailboxes_domain_local_unique").on(t.domainId, t.localPart),
    uniqueIndex("mailboxes_email_address_unique").on(t.emailAddress),
    index("mailboxes_domain_idx").on(t.domainId),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ipHint: varchar("ip_hint", { length: 45 }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_unique").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
  ]
);

export const authLoginOutcomeEnum = ["success", "failed"] as const;
export type AuthLoginOutcome = (typeof authLoginOutcomeEnum)[number];

export const authLoginMethodEnum = [
  "password",
  "passkey",
  "admin_password",
] as const;
export type AuthLoginMethod = (typeof authLoginMethodEnum)[number];

export const authLoginContextEnum = ["app", "admin_panel"] as const;
export type AuthLoginContext = (typeof authLoginContextEnum)[number];

export const authLoginEvents = pgTable(
  "auth_login_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    outcome: varchar("outcome", { length: 16 }).notNull().$type<AuthLoginOutcome>(),
    authMethod: varchar("auth_method", { length: 24 })
      .notNull()
      .$type<AuthLoginMethod>(),
    context: varchar("context", { length: 24 })
      .notNull()
      .$type<AuthLoginContext>(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    identifier: varchar("identifier", { length: 320 }).notNull(),
    failureCode: varchar("failure_code", { length: 64 }),
    ipHint: varchar("ip_hint", { length: 45 }),
    userAgent: text("user_agent"),
    geoCountry: varchar("geo_country", { length: 128 }),
    geoCity: varchar("geo_city", { length: 256 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("auth_login_events_created_idx").on(t.createdAt),
    index("auth_login_events_user_created_idx").on(t.userId, t.createdAt),
    index("auth_login_events_ip_created_idx").on(t.ipHint, t.createdAt),
    index("auth_login_events_identifier_idx").on(t.identifier),
    index("auth_login_events_failed_idx").on(t.outcome, t.createdAt),
  ]
);

export const passkeyCredentials = pgTable(
  "passkey_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Base64URL credential id. */
    credentialId: varchar("credential_id", { length: 512 }).notNull(),
    /** Base64URL-encoded public key. */
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    transports: jsonb("transports").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("passkey_credentials_credential_unique").on(t.credentialId),
    index("passkey_credentials_user_idx").on(t.userId),
  ]
);

export const messageFolderEnum = [
  "inbox",
  "sent",
  "spam",
  "trash",
  "archive",
] as const;
export type MessageFolder = (typeof messageFolderEnum)[number];

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    folder: varchar("folder", { length: 16 }).notNull().$type<MessageFolder>(),
    providerMessageId: varchar("provider_message_id", { length: 512 }),
    subject: text("subject").notNull().default(""),
    snippet: text("snippet").notNull().default(""),
    bodyText: text("body_text").notNull().default(""),
    bodyHtml: text("body_html"),
    fromAddr: text("from_addr").notNull().default(""),
    toAddr: text("to_addr").notNull().default(""),
    ccAddr: text("cc_addr").notNull().default(""),
    bccAddr: text("bcc_addr").notNull().default(""),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    starred: boolean("starred").notNull().default(false),
    pinned: boolean("pinned").notNull().default(false),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    threadId: uuid("thread_id").notNull(),
    inReplyTo: text("in_reply_to"),
    mailedBy: text("mailed_by"),
    signedBy: text("signed_by"),
    hasAttachment: boolean("has_attachment").notNull().default(false),
    /** True when the message was sent with recipient-facing anonymous From (internal user still userId). */
    sentAnonymously: boolean("sent_anonymously").notNull().default(false),
    /** Set when message is moved to trash (for retention / countdown). */
    trashMovedAt: timestamp("trash_moved_at", { withTimezone: true }),
    /** Auto-delete cutoff timestamp (trash_moved_at + 30 days). */
    trashDeleteAfterAt: timestamp("trash_delete_after_at", { withTimezone: true }),
    /** Heuristic / manual spam score (inbound classification; 5+ typically means spam folder). */
    spamScore: integer("spam_score").notNull().default(0),
    /** normal | high | low — automation / UX priority. */
    priority: varchar("priority", { length: 16 }).notNull().default("normal"),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("messages_user_folder_created_idx").on(
      t.userId,
      t.folder,
      t.createdAt
    ),
    index("messages_user_thread_idx").on(t.userId, t.threadId),
    index("messages_user_starred_idx").on(t.userId, t.starred),
    index("messages_user_pinned_idx").on(t.userId, t.pinned, t.pinnedAt),
    index("messages_trash_expiry_idx").on(t.folder, t.trashDeleteAfterAt),
    uniqueIndex("messages_provider_msg_unique").on(t.userId, t.providerMessageId),
    index("messages_assigned_idx").on(t.assignedToUserId),
    index("messages_resolved_idx").on(t.resolvedAt),
  ]
);

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 64 }).notNull(),
    color: varchar("color", { length: 7 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("labels_user_name_unique").on(t.userId, t.name)]
);

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: varchar("theme", { length: 16 }).notNull().default("system"),
  accentHex: varchar("accent_hex", { length: 7 }).notNull().default("#5b4dff"),
  conversationView: boolean("conversation_view").notNull().default(true),
  unreadFirst: boolean("unread_first").notNull().default(false),
  inboxDensity: varchar("inbox_density", { length: 16 })
    .notNull()
    .default("comfortable"),
  signatureHtml: text("signature_html").notNull().default(""),
  composeFont: varchar("compose_font", { length: 32 }).notNull().default("system"),
  draftAutoSave: boolean("draft_auto_save").notNull().default(true),
  blockTrackers: boolean("block_trackers").notNull().default(true),
  readReceiptsOutgoing: boolean("read_receipts_outgoing")
    .notNull()
    .default(false),
  externalImages: varchar("external_images", { length: 16 })
    .notNull()
    .default("ask"),
  notificationsEnabled: boolean("notifications_enabled")
    .notNull()
    .default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const blockedSenders = pgTable(
  "blocked_senders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("blocked_senders_user_email").on(t.userId, t.email)]
);

export const senderMailPreferenceEnum = ["trust", "spam"] as const;
export type SenderMailPreference = (typeof senderMailPreferenceEnum)[number];

export const senderMailPreferences = pgTable(
  "sender_mail_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pattern: varchar("pattern", { length: 320 }).notNull(),
    preference: varchar("preference", { length: 16 })
      .notNull()
      .$type<SenderMailPreference>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("sender_mail_preferences_user_pattern_unique").on(
      t.userId,
      t.pattern
    ),
    index("sender_mail_preferences_user_idx").on(t.userId),
  ]
);

export const filterRuleActionEnum = ["trash", "label"] as const;
export type FilterRuleAction = (typeof filterRuleActionEnum)[number];

export const mailFilterRules = pgTable(
  "mail_filter_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fromMatch: varchar("from_match", { length: 320 }).notNull(),
    action: varchar("action", { length: 16 }).notNull().$type<FilterRuleAction>(),
    labelId: uuid("label_id").references(() => labels.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("mail_filter_rules_user_idx").on(t.userId)]
);

export const messageLabels = pgTable(
  "message_labels",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.labelId] })]
);

/**
 * Maps a per-send anonymous alias (local part under EMAIL_DOMAIN) to the real sender and sent row.
 * Recipient-facing mail uses the alias; only the server can resolve it (moderation, replies).
 */
export const anonymousSendAliases = pgTable(
  "anonymous_send_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    aliasLocalPart: varchar("alias_local_part", { length: 96 }).notNull(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("anonymous_send_aliases_local_unique").on(t.aliasLocalPart),
    index("anonymous_send_aliases_user_idx").on(t.userId),
  ]
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    filename: varchar("filename", { length: 512 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("attachments_message_idx").on(t.messageId)]
);

export const composeDrafts = pgTable("compose_drafts", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  toAddr: text("to_addr").notNull().default(""),
  ccAddr: text("cc_addr").notNull().default(""),
  bccAddr: text("bcc_addr").notNull().default(""),
  subject: text("subject").notNull().default(""),
  bodyText: text("body_text").notNull().default(""),
  bodyHtml: text("body_html").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * Draft attachments uploaded while composing. Linked to the per-user
 * single-row draft (`compose_drafts`), but stored separately so we can
 * support multi/inline media without bloating `compose_drafts`.
 */
export const composeAttachments = pgTable(
  "compose_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: varchar("filename", { length: 512 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    /**
     * If set, this attachment should be sent inline via Resend and can
     * be referenced in the HTML via `cid:${contentId}`.
     */
    contentId: varchar("content_id", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("compose_attachments_user_idx").on(t.userId)]
);

/**
 * Scheduled outbound email jobs (for schedule send + undo send).
 * We store the final rendered HTML/text snapshot so processing can run
 * later without depending on draft rows.
 */
export const scheduledEmails = pgTable(
  "scheduled_emails",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    toAddr: text("to_addr").notNull().default(""),
    ccAddr: text("cc_addr").notNull().default(""),
    bccAddr: text("bcc_addr").notNull().default(""),
    subject: text("subject").notNull().default(""),

    bodyText: text("body_text").notNull().default(""),
    bodyHtml: text("body_html").notNull().default(""),

    mailboxId: varchar("mailbox_id", { length: 128 }),

    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("scheduled"),
    sendAnonymously: boolean("send_anonymously").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    index("scheduled_emails_user_send_idx").on(t.userId, t.sendAt),
    index("scheduled_emails_send_at_idx").on(t.sendAt),
  ]
);

export const scheduledEmailAttachments = pgTable(
  "scheduled_email_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scheduledEmailId: uuid("scheduled_email_id")
      .notNull()
      .references(() => scheduledEmails.id, { onDelete: "cascade" }),
    filename: varchar("filename", { length: 512 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("scheduled_email_attachments_email_idx").on(t.scheduledEmailId),
  ]
);

export const confidentialPasscodeModeEnum = ["none", "email_otp", "sms_otp"] as const;
export type ConfidentialPasscodeMode = (typeof confidentialPasscodeModeEnum)[number];

/**
 * Secure-link confidential viewer payload.
 * We store the message body server-side and email a link containing an opaque token.
 */
export const confidentialMessages = pgTable(
  "confidential_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    subject: text("subject").notNull().default(""),
    bodyText: text("body_text").notNull().default(""),
    bodyHtml: text("body_html").notNull().default(""),
    passcodeMode: varchar("passcode_mode", { length: 16 })
      .notNull()
      .default("none")
      .$type<ConfidentialPasscodeMode>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("confidential_messages_token_hash_unique").on(t.tokenHash),
    index("confidential_messages_owner_idx").on(t.ownerUserId, t.createdAt),
    index("confidential_messages_expires_idx").on(t.expiresAt),
  ]
);

export const importantContacts = pgTable(
  "important_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pattern: varchar("pattern", { length: 320 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("important_contacts_user_pattern_unique").on(t.userId, t.pattern),
    index("important_contacts_user_idx").on(t.userId),
  ]
);

/** JSON automation conditions / actions — see `src/lib/email-automation.ts`. */
export type AutomationConditionJson =
  | { kind: "from"; op: "equals" | "contains" | "domain"; value: string }
  | { kind: "subject"; op: "contains"; value: string }
  | { kind: "body"; op: "contains"; value: string }
  | { kind: "sender_unknown" }
  | { kind: "important_contact" };

export type AutomationActionJson =
  | { type: "move_folder"; folder: MessageFolder }
  | { type: "apply_label"; labelId: string }
  | { type: "mark_spam" }
  | { type: "set_priority"; priority: "high" | "normal" | "low" }
  | { type: "forward"; to: string }
  | { type: "mark_read"; read: boolean }
  | { type: "star"; starred: boolean };

export const emailAutomationRules = pgTable(
  "email_automation_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull().default(""),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    conditions: jsonb("conditions")
      .$type<AutomationConditionJson[]>()
      .notNull(),
    actions: jsonb("actions").$type<AutomationActionJson[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("email_automation_rules_user_enabled_idx").on(
      t.userId,
      t.enabled,
      t.sortOrder
    ),
  ]
);

export const automationWorkflows = pgTable(
  "automation_workflows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull().default(""),
    enabled: boolean("enabled").notNull().default(true),
    triggerConditions: jsonb("trigger_conditions")
      .$type<AutomationConditionJson[]>()
      .notNull(),
    steps: jsonb("steps").$type<AutomationActionJson[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("automation_workflows_user_enabled_idx").on(t.userId, t.enabled),
  ]
);

export const workspaceRoleEnum = ["admin", "member", "viewer"] as const;
export type WorkspaceRole = (typeof workspaceRoleEnum)[number];

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 128 }).notNull().default(""),
    inboxOwnerUserId: uuid("inbox_owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("workspaces_inbox_owner_idx").on(t.inboxOwnerUserId)]
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 16 }).notNull().$type<WorkspaceRole>(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    index("workspace_members_user_idx").on(t.userId),
  ]
);

export const scheduledReminderStatusEnum = [
  "pending",
  "completed",
  "cancelled",
] as const;
export type ScheduledReminderStatus =
  (typeof scheduledReminderStatusEnum)[number];

export const scheduledReminders = pgTable(
  "scheduled_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "cascade",
    }),
    kind: varchar("kind", { length: 24 }).notNull(),
    note: text("note").notNull().default(""),
    remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
    status: varchar("status", { length: 16 })
      .notNull()
      .default("pending")
      .$type<ScheduledReminderStatus>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("scheduled_reminders_user_status_idx").on(
      t.userId,
      t.status,
      t.remindAt
    ),
    index("scheduled_reminders_due_idx").on(t.status, t.remindAt),
  ]
);

export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 }).notNull(),
    title: varchar("title", { length: 256 }).notNull().default(""),
    body: text("body").notNull().default(""),
    readAt: timestamp("read_at", { withTimezone: true }),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("user_notifications_user_created_idx").on(t.userId, t.createdAt),
    index("user_notifications_user_unread_idx").on(t.userId, t.readAt),
  ]
);

export const userAuditLogs = pgTable(
  "user_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 64 }).notNull(),
    resourceType: varchar("resource_type", { length: 64 }).notNull().default(""),
    resourceId: varchar("resource_id", { length: 128 }).notNull().default(""),
    detail: text("detail"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("user_audit_logs_user_created_idx").on(t.userId, t.createdAt)]
);

export const userApiAccessTokens = pgTable(
  "user_api_access_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    label: varchar("label", { length: 128 }).notNull().default(""),
    scopes: jsonb("scopes").$type<string[]>(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("user_api_access_tokens_hash_unique").on(t.tokenHash),
    index("user_api_access_tokens_user_idx").on(t.userId),
  ]
);

export const confidentialOtps = pgTable(
  "confidential_otps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => confidentialMessages.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("confidential_otps_message_email_idx").on(t.messageId, t.email, t.createdAt),
    index("confidential_otps_expires_idx").on(t.expiresAt),
  ]
);
