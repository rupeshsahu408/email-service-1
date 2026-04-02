import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { listLoginEvents } from "@/lib/admin-security";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().optional(),
  ip: z.string().optional(),
  device: z.string().optional(),
  outcome: z.enum(["success", "failed"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  suspiciousOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  highRiskOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
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
  const { rows, total } = await listLoginEvents({
    page: d.page,
    pageSize: d.pageSize,
    q: d.q,
    ip: d.ip,
    device: d.device,
    outcome: d.outcome,
    dateFrom: d.dateFrom,
    dateTo: d.dateTo,
    suspiciousOnly: d.suspiciousOnly,
    highRiskOnly: d.highRiskOnly,
  });

  return NextResponse.json({
    events: rows,
    total,
    page: d.page,
    pageSize: d.pageSize,
    totalPages: Math.max(1, Math.ceil(total / d.pageSize)),
  });
}
