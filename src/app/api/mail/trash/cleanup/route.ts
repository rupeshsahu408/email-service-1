import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  countExpiredTrashMessages,
  deleteExpiredTrashMessages,
} from "@/lib/trash-lifecycle";

export const runtime = "nodejs";

/**
 * Worker endpoint: permanently deletes trash rows past retention (30 days).
 * Protect with x-worker-token in production.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.TRASH_CLEANUP_WORKER_TOKEN;
  if (expected && request.headers.get("x-worker-token") !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();
  const eligibleBefore = await countExpiredTrashMessages(db);
  const deletedCount = await deleteExpiredTrashMessages(db);

  return NextResponse.json({
    ok: true,
    eligibleBefore,
    deletedCount,
  });
}
