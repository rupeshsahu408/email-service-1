/**
 * Applies drizzle/0013_domain_management_phase4.sql when `npm run db:migrate`
 * did not run (e.g. journal mismatch) or columns are missing.
 * Splits on Drizzle's `--> statement-breakpoint` markers (not valid SQL otherwise).
 */
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const migrationPath = path.join(
  __dirname,
  "..",
  "drizzle",
  "0013_domain_management_phase4.sql"
);

const sqlText = await fs.readFile(migrationPath, "utf8");
const statements = sqlText
  .split(/-->\s*statement-breakpoint\s*\n/gi)
  .map((s) => s.trim())
  .filter(Boolean);

const local =
  /localhost|127\.0\.0\.1/.test(url) || process.env.DATABASE_SSL === "0";

const sql = postgres(url, {
  max: 1,
  connect_timeout: 15,
  idle_timeout: 20,
  ssl: local ? false : "require",
});

try {
  for (const stmt of statements) {
    await sql.unsafe(stmt);
  }
  console.log("OK: Phase 4 domain schema applied from", migrationPath);
} catch (e) {
  console.error("Failed:", e.message);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
