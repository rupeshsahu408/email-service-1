import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getEmailDomain, formatUserEmail } from "@/lib/constants";
import { hashSecret } from "@/lib/password";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { isReservedUsername } from "@/lib/reserved-usernames";
import { adminCreateUserBodySchema } from "@/lib/validation";
import {
  listAdminUsers,
  type AdminUserListParams,
  type AdminUserListSort,
  type AdminUserStatusFilter,
} from "@/lib/admin-users";
import { recordAdminActivity } from "@/lib/admin-activity";
import { randomBytes } from "crypto";
import { getAdminSystemSettings } from "@/lib/admin-system-settings";

export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
  status: z
    .enum(["all", "active", "suspended", "deleted"])
    .default("all"),
  emailVerified: z.enum(["all", "true", "false"]).default("all"),
  plan: z.enum(["all", "free", "business", "pro"]).default("all"),
  signupFrom: z.string().optional(),
  signupTo: z.string().optional(),
  sort: z
    .enum(["newest", "oldest", "name", "email", "last_login"])
    .default("newest"),
});

function parseListParams(sp: URLSearchParams): AdminUserListParams {
  const raw = Object.fromEntries(sp.entries());
  const parsed = listQuerySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("BAD_QUERY");
  }
  const d = parsed.data;
  return {
    page: d.page,
    pageSize: d.pageSize,
    q: d.q,
    status: d.status as AdminUserStatusFilter,
    emailVerified: d.emailVerified as "all" | "true" | "false",
    plan: d.plan as AdminUserListParams["plan"],
    signupFrom: d.signupFrom,
    signupTo: d.signupTo,
    sort: d.sort as AdminUserListSort,
  };
}

export async function GET(request: NextRequest) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let params: AdminUserListParams;
  try {
    params = parseListParams(request.nextUrl.searchParams);
  } catch {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const { rows, total } = await listAdminUsers(params);
  return NextResponse.json({
    users: rows,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  });
}

export async function POST(request: NextRequest) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = adminCreateUserBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const settings = await getAdminSystemSettings();
  if (d.password.length < settings.security.minPasswordLength) {
    return NextResponse.json(
      { error: `Password must be at least ${settings.security.minPasswordLength} characters.` },
      { status: 400 }
    );
  }
  const emailNorm = d.email.trim().toLowerCase();
  const domain = getEmailDomain().toLowerCase();
  const at = emailNorm.lastIndexOf("@");
  if (at <= 0) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const localPart = emailNorm.slice(0, at).toLowerCase();
  const emailDomain = emailNorm.slice(at + 1);
  if (emailDomain !== domain) {
    return NextResponse.json(
      {
        error: `Email must use @${domain}`,
      },
      { status: 400 }
    );
  }

  if (isReservedUsername(localPart)) {
    return NextResponse.json(
      { error: "This username is reserved" },
      { status: 400 }
    );
  }

  const taken = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.localPart, localPart))
    .limit(1);
  if (taken.length > 0) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await hashSecret(d.password);
  const recoveryKey = randomBytes(32).toString("hex");
  const recoveryKeyHash = await hashSecret(recoveryKey);

  const isSuspended = d.accountStatus === "suspended";
  const now = new Date();

  const inserted = await getDb()
    .insert(users)
    .values({
      localPart,
      fullName: d.fullName.trim(),
      passwordHash,
      recoveryKeyHash,
      plan: d.plan,
      emailVerified: d.emailVerified,
      isAdmin: d.isAdmin,
      isSuspended,
      suspendedAt: isSuspended ? now : null,
      suspensionReason: isSuspended ? "Created as suspended" : null,
      accountType: d.accountType,
      storageQuotaBytes:
        settings.storage.perUserStorageLimitBytes > 0
          ? settings.storage.perUserStorageLimitBytes
          : undefined,
      updatedAt: now,
    })
    .returning({ id: users.id });

  const id = inserted[0]?.id;
  if (!id) {
    return NextResponse.json({ error: "Could not create user" }, { status: 500 });
  }

  await recordAdminActivity({
    eventType: "admin_user_created",
    severity: "info",
    actorUserId: admin.id,
    subjectUserId: id,
    detail: "User created by admin.",
    meta: { email: formatUserEmail(localPart) },
  });

  return NextResponse.json({
    ok: true,
    user: {
      id,
      email: formatUserEmail(localPart),
    },
  });
}
