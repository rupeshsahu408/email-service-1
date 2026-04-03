import { sql } from "drizzle-orm";
import { getDb } from "@/db";

let supportPromise: Promise<boolean> | null = null;

export function hasMessageAuthColumns(): Promise<boolean> {
  if (!supportPromise) {
    supportPromise = (async () => {
      const rows = await getDb().execute(
        sql<{ column_name: string }>`
          select column_name
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'messages'
            and column_name in ('mailed_by', 'signed_by')
        `
      );
      const names = new Set(
        rows.map((r) =>
          String((r as { column_name?: string }).column_name ?? "").toLowerCase()
        )
      );
      return names.has("mailed_by") && names.has("signed_by");
    })().catch(() => false);
  }
  return supportPromise;
}

