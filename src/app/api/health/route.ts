import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { logError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const deep = request.nextUrl.searchParams.get("deep") === "1";
  if (!deep) {
    return NextResponse.json({ ok: true, service: "america-2" });
  }
  try {
    const db = getDb();
    await db.execute(sql`select 1`);

    const currentDatabaseRows = await db.execute<{ current_database: string }>(
      sql`select current_database() as current_database`
    );
    const currentSchemaRows = await db.execute<{ current_schema: string }>(
      sql`select current_schema() as current_schema`
    );
    const composeAttachmentsRows = await db.execute<{
      regclass: string | null;
    }>(sql`select to_regclass('public.compose_attachments') as regclass`);

    const currentDatabase = currentDatabaseRows[0]?.current_database ?? null;
    const currentSchema = currentSchemaRows[0]?.current_schema ?? null;
    const composeAttachmentsTable = composeAttachmentsRows[0]?.regclass ?? null;
    return NextResponse.json({
      ok: true,
      service: "america-2",
      database: "up",
      currentDatabase,
      currentSchema,
      composeAttachmentsTable,
    });
  } catch (e) {
    logError("health_db_check_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json(
      {
        ok: false,
        service: "america-2",
        database: "down",
        error:
          "Database unreachable or DATABASE_URL missing. Run migrations if the schema is new.",
      },
      { status: 503 }
    );
  }
}
