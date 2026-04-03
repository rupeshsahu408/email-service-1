import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import {
  fetchAllAdminUsersMatching,
  fetchUsersForExport,
  type AdminUserListParams,
  type AdminUserListSort,
  type AdminUserStatusFilter,
} from "@/lib/admin-users";

export const dynamic = "force-dynamic";

const filterQuerySchema = z.object({
  ids: z.string().optional(),
  q: z.string().optional(),
  status: z.enum(["all", "active", "suspended", "deleted"]).default("all"),
  emailVerified: z.enum(["all", "true", "false"]).default("all"),
  plan: z.enum(["all", "free", "business", "pro"]).default("all"),
  signupFrom: z.string().optional(),
  signupTo: z.string().optional(),
  sort: z
    .enum(["newest", "oldest", "name", "email", "last_login"])
    .default("newest"),
});

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: NextRequest) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const raw = Object.fromEntries(sp.entries());
  const parsed = filterQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const idsParam = parsed.data.ids?.trim();
  let rows;
  if (idsParam) {
    const ids = idsParam
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const uuidOk =
      ids.length > 0 &&
      ids.every((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id
        )
      );
    if (!uuidOk) {
      return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
    }
    rows = await fetchUsersForExport(ids);
  } else {
    const d = parsed.data;
    const params: Omit<AdminUserListParams, "page" | "pageSize"> = {
      q: d.q,
      status: d.status as AdminUserStatusFilter,
      emailVerified: d.emailVerified as "all" | "true" | "false",
      plan: d.plan as AdminUserListParams["plan"],
      signupFrom: d.signupFrom,
      signupTo: d.signupTo,
      sort: d.sort as AdminUserListSort,
    };
    rows = await fetchAllAdminUsersMatching(params);
  }

  const header = [
    "name",
    "email",
    "status",
    "verified",
    "plan",
    "signup_date",
    "last_login",
    "storage_used_bytes",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        csvEscape(r.fullName),
        csvEscape(r.email),
        csvEscape(r.status),
        csvEscape(String(r.emailVerified)),
        csvEscape(r.plan),
        csvEscape(r.createdAt),
        csvEscape(r.lastLoginAt ?? ""),
        csvEscape(String(r.storageUsedBytes)),
      ].join(",")
    ),
  ];
  const csv = lines.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="sendora-users-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
