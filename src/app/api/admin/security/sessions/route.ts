import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { listActiveSessions } from "@/lib/admin-security";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().optional(),
});

export async function GET(request: NextRequest) {
  await ensureSessionSchema();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const d = parsed.data;
  const { rows, total } = await listActiveSessions({
    page: d.page,
    pageSize: d.pageSize,
    q: d.q,
  });

  return NextResponse.json({
    sessions: rows,
    total,
    page: d.page,
    pageSize: d.pageSize,
    totalPages: Math.max(1, Math.ceil(total / d.pageSize)),
  });
}
