import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin, ensureSessionSchema } from "@/lib/session";
import { getHighRiskUsers } from "@/lib/admin-security";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
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

  const users = await getHighRiskUsers(parsed.data.limit);
  return NextResponse.json({ users });
}
