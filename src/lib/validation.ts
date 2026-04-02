import { z } from "zod";
import { isReservedUsername } from "./reserved-usernames";

/** Login and general username format (does not block reserved words — existing accounts must keep signing in). */
export const usernameSchema = z
  .string()
  .min(3, "At least 3 characters")
  .max(32, "At most 32 characters")
  .regex(
    /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/i,
    "Letters, numbers, dot, underscore, hyphen only"
  );

/** Signup / availability only. */
export const registrationUsernameSchema = usernameSchema.refine(
  (v) => !isReservedUsername(v.toLowerCase()),
  "This username is reserved"
);

export const passwordSchema = z
  .string()
  .min(12, "At least 12 characters");

export const signupBodySchema = z.object({
  username: registrationUsernameSchema,
  password: passwordSchema,
  turnstileToken: z.string().min(1, "Verification required"),
});

export const loginBodySchema = z.object({
  identifier: z.string().min(1, "Email is required").max(320),
  password: z.string().min(1),
});

export const adminLoginBodySchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const adminUserPlanSchema = z.enum(["free", "business", "pro"]);

export const adminAccountTypeSchema = z.enum([
  "personal",
  "business",
  "professional",
]);

export const adminCreateUserBodySchema = z.object({
  fullName: z.string().min(1, "Name is required").max(256),
  email: z.email("Enter a valid email"),
  password: passwordSchema,
  plan: adminUserPlanSchema,
  accountType: adminAccountTypeSchema,
  accountStatus: z.enum(["active", "suspended"]),
  emailVerified: z.boolean(),
  isAdmin: z.boolean().optional().default(false),
});

export const adminPatchUserBodySchema = z
  .object({
    fullName: z.string().min(1).max(256).optional(),
    email: z.email().optional(),
    plan: adminUserPlanSchema.optional(),
    accountType: adminAccountTypeSchema.optional(),
    accountStatus: z.enum(["active", "suspended", "deleted"]).optional(),
    emailVerified: z.boolean().optional(),
    storageQuotaBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
    adminNotes: z.string().max(50_000).optional(),
    isAdmin: z.boolean().optional(),
  })
  .strict();

export const adminSuspendBodySchema = z.object({
  reason: z.string().max(2000).optional(),
});

export const adminAppendNoteBodySchema = z.object({
  text: z.string().min(1, "Note cannot be empty").max(8000),
});

const bulkIds = z.array(z.string().uuid()).min(1).max(500);

export const adminBulkBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("suspend"),
    userIds: bulkIds,
    reason: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal("unsuspend"),
    userIds: bulkIds,
  }),
  z.object({
    action: z.literal("verify"),
    userIds: bulkIds,
  }),
  z.object({
    action: z.literal("delete"),
    userIds: bulkIds,
  }),
]);

const bulkDomainIds = z.array(z.string().uuid()).min(1).max(200);

export const adminBulkDomainsBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("verify_dns"),
    domainIds: bulkDomainIds,
  }),
  z.object({
    action: z.literal("recheck_dns"),
    domainIds: bulkDomainIds,
  }),
  z.object({
    action: z.literal("suspend"),
    domainIds: bulkDomainIds,
    reason: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal("unsuspend"),
    domainIds: bulkDomainIds,
  }),
  z.object({
    action: z.literal("disable_sending"),
    domainIds: bulkDomainIds,
    reason: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal("enable_sending"),
    domainIds: bulkDomainIds,
  }),
]);

export const adminCreateDomainBodySchema = z.object({
  domainName: z.string().min(3).max(255),
  ownerUserId: z.string().uuid(),
  adminNotes: z.string().max(20_000).optional(),
});
