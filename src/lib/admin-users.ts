import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "@/db";
import { domains, users } from "@/db/schema";
import { formatUserEmail, getEmailDomain } from "@/lib/constants";
import { computeUserStorageUsedBytes } from "@/lib/storage-quota";

export const ADMIN_USER_PLANS = [
  "free",
  "business",
  "pro",
] as const;
export type AdminUserPlan = (typeof ADMIN_USER_PLANS)[number];

export const ADMIN_ACCOUNT_TYPES = ["personal", "business", "professional"] as const;
export type AdminAccountType = (typeof ADMIN_ACCOUNT_TYPES)[number];

export type AdminUserListSort =
  | "newest"
  | "oldest"
  | "name"
  | "email"
  | "last_login";

export type AdminUserStatusFilter =
  | "all"
  | "active"
  | "suspended"
  | "deleted";

export type AdminUserListParams = {
  page: number;
  pageSize: number;
  q?: string;
  status: AdminUserStatusFilter;
  emailVerified?: "all" | "true" | "false";
  plan?: AdminUserPlan | "all";
  signupFrom?: string;
  signupTo?: string;
  sort: AdminUserListSort;
};

export type AdminUserRow = {
  id: string;
  fullName: string;
  email: string;
  localPart: string;
  plan: string;
  accountType: string;
  status: "active" | "suspended" | "deleted";
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  storageUsedBytes: number;
  storageQuotaBytes: number;
};

function statusForUser(u: {
  deletedAt: Date | null;
  isSuspended: boolean;
}): "active" | "suspended" | "deleted" {
  if (u.deletedAt) return "deleted";
  if (u.isSuspended) return "suspended";
  return "active";
}

function buildWhere(params: AdminUserListParams) {
  const conditions: ReturnType<typeof and>[] = [];

  const st = params.status;
  if (st === "active") {
    conditions.push(isNull(users.deletedAt));
    conditions.push(eq(users.isSuspended, false));
  } else if (st === "suspended") {
    conditions.push(isNull(users.deletedAt));
    conditions.push(eq(users.isSuspended, true));
  } else if (st === "deleted") {
    conditions.push(isNotNull(users.deletedAt));
  }

  if (params.emailVerified === "true") {
    conditions.push(eq(users.emailVerified, true));
  } else if (params.emailVerified === "false") {
    conditions.push(eq(users.emailVerified, false));
  }

  if (params.plan && params.plan !== "all") {
    conditions.push(eq(users.plan, params.plan));
  }

  if (params.signupFrom) {
    const d = new Date(params.signupFrom);
    if (!Number.isNaN(d.getTime())) conditions.push(gte(users.createdAt, d));
  }
  if (params.signupTo) {
    const d = new Date(params.signupTo);
    if (!Number.isNaN(d.getTime())) {
      const end = new Date(d);
      end.setUTCHours(23, 59, 59, 999);
      conditions.push(lte(users.createdAt, end));
    }
  }

  const rawQ = params.q?.trim();
  if (rawQ) {
    const safe = rawQ.replace(/[%_\\]/g, "").trim() || rawQ;
    const pattern = `%${safe}%`;
    const uuidLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        rawQ
      );
    const domain = getEmailDomain();
    const domainMatch =
      safe.includes("@") || safe.toLowerCase().includes(domain.toLowerCase());

    const searchOr = [
      ilike(users.localPart, pattern),
      ilike(users.fullName, pattern),
    ];

    if (uuidLike) {
      searchOr.push(eq(users.id, rawQ));
    }

    if (domainMatch || safe.includes(".")) {
      searchOr.push(
        sql`exists (
          select 1 from ${domains} d
          where d.owner_user_id = ${users.id}
          and d.domain_name ilike ${pattern}
        )`
      );
    }

    conditions.push(or(...searchOr)!);
  }

  return conditions.length ? and(...conditions) : undefined;
}

function orderByClause(sort: AdminUserListSort) {
  switch (sort) {
    case "oldest":
      return [asc(users.createdAt)];
    case "name":
      return [asc(users.fullName), asc(users.localPart)];
    case "email":
      return [asc(users.localPart)];
    case "last_login":
      return [
        sql`${users.lastLoginAt} desc nulls last`,
        desc(users.createdAt),
      ];
    case "newest":
    default:
      return [desc(users.createdAt)];
  }
}

async function mapBaseRowsToAdminRows(
  db: ReturnType<typeof getDb>,
  baseRows: Array<{
    id: string;
    fullName: string;
    localPart: string;
    plan: string;
    accountType: string;
    isSuspended: boolean;
    deletedAt: Date | null;
    emailVerified: boolean;
    isAdmin: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
    storageQuotaBytes: number;
  }>
): Promise<AdminUserRow[]> {
  const storagePairs = await Promise.all(
    baseRows.map(async (r) => {
      const snap = await computeUserStorageUsedBytes(db, r.id);
      return [r.id, snap.usedBytes] as const;
    })
  );
  const storageMap = new Map(storagePairs);

  return baseRows.map((r) => ({
    id: r.id,
    fullName: r.fullName || r.localPart,
    email: formatUserEmail(r.localPart),
    localPart: r.localPart,
    plan: r.plan,
    accountType: r.accountType,
    status: statusForUser(r),
    emailVerified: r.emailVerified,
    isAdmin: r.isAdmin,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
    storageUsedBytes: storageMap.get(r.id) ?? 0,
    storageQuotaBytes: Number(r.storageQuotaBytes),
  }));
}

const listSelectShape = {
  id: users.id,
  fullName: users.fullName,
  localPart: users.localPart,
  plan: users.plan,
  accountType: users.accountType,
  isSuspended: users.isSuspended,
  deletedAt: users.deletedAt,
  emailVerified: users.emailVerified,
  isAdmin: users.isAdmin,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  lastLoginAt: users.lastLoginAt,
  storageQuotaBytes: users.storageQuotaBytes,
};

export async function listAdminUsers(
  params: AdminUserListParams
): Promise<{ rows: AdminUserRow[]; total: number }> {
  const db = getDb();
  const where = buildWhere(params);
  const order = orderByClause(params.sort);

  const totalRow = await db
    .select({ c: count() })
    .from(users)
    .where(where);

  const total = Number(totalRow[0]?.c ?? 0);
  const offset = (params.page - 1) * params.pageSize;

  const baseRows = await db
    .select(listSelectShape)
    .from(users)
    .where(where)
    .orderBy(...order)
    .limit(params.pageSize)
    .offset(offset);

  const rows = await mapBaseRowsToAdminRows(db, baseRows);

  return { rows, total };
}

/** All rows matching filters (no pagination). Use for CSV export of current filter. */
export async function fetchAllAdminUsersMatching(
  params: Omit<AdminUserListParams, "page" | "pageSize">
): Promise<AdminUserRow[]> {
  const db = getDb();
  const where = buildWhere({ ...params, page: 1, pageSize: 1 });
  const order = orderByClause(params.sort);
  const baseRows = await db
    .select(listSelectShape)
    .from(users)
    .where(where)
    .orderBy(...order);
  return mapBaseRowsToAdminRows(db, baseRows);
}

export async function getAdminUserDetail(
  id: string
): Promise<AdminUserRow & {
  suspensionReason: string | null;
  suspendedAt: string | null;
  adminNotes: string | null;
  passwordResetPending: boolean;
}> {
  const db = getDb();
  const row = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      localPart: users.localPart,
      plan: users.plan,
      accountType: users.accountType,
      isSuspended: users.isSuspended,
      deletedAt: users.deletedAt,
      emailVerified: users.emailVerified,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
      storageQuotaBytes: users.storageQuotaBytes,
      suspensionReason: users.suspensionReason,
      suspendedAt: users.suspendedAt,
      adminNotes: users.adminNotes,
      passwordResetTokenHash: users.passwordResetTokenHash,
      passwordResetTokenExpiresAt: users.passwordResetTokenExpiresAt,
      passwordResetTokenUsedAt: users.passwordResetTokenUsedAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!row) {
    throw new Error("USER_NOT_FOUND");
  }

  const snap = await computeUserStorageUsedBytes(db, id);
  const now = Date.now();
  const passwordResetPending = Boolean(
    row.passwordResetTokenHash &&
      row.passwordResetTokenExpiresAt &&
      !row.passwordResetTokenUsedAt &&
      new Date(row.passwordResetTokenExpiresAt).getTime() > now
  );

  return {
    id: row.id,
    fullName: row.fullName || row.localPart,
    email: formatUserEmail(row.localPart),
    localPart: row.localPart,
    plan: row.plan,
    accountType: row.accountType,
    status: statusForUser(row),
    emailVerified: row.emailVerified,
    isAdmin: row.isAdmin,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    storageUsedBytes: snap.usedBytes,
    storageQuotaBytes: Number(row.storageQuotaBytes),
    suspensionReason: row.suspensionReason,
    suspendedAt: row.suspendedAt?.toISOString() ?? null,
    adminNotes: row.adminNotes,
    passwordResetPending,
  };
}

export async function fetchUsersForExport(
  ids: string[]
): Promise<AdminUserRow[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const baseRows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      localPart: users.localPart,
      plan: users.plan,
      accountType: users.accountType,
      isSuspended: users.isSuspended,
      deletedAt: users.deletedAt,
      emailVerified: users.emailVerified,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
      storageQuotaBytes: users.storageQuotaBytes,
    })
    .from(users)
    .where(inArray(users.id, ids));

  const out: AdminUserRow[] = [];
  for (const r of baseRows) {
    const snap = await computeUserStorageUsedBytes(db, r.id);
    out.push({
      id: r.id,
      fullName: r.fullName || r.localPart,
      email: formatUserEmail(r.localPart),
      localPart: r.localPart,
      plan: r.plan,
      accountType: r.accountType,
      status: statusForUser(r),
      emailVerified: r.emailVerified,
      isAdmin: r.isAdmin,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
      storageUsedBytes: snap.usedBytes,
      storageQuotaBytes: Number(r.storageQuotaBytes),
    });
  }
  return out;
}

