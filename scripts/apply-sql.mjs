import "dotenv/config";
import fs from "fs/promises";
import postgres from "postgres";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-sql.mjs <path-to-sql>");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sqlText = await fs.readFile(file, "utf8");
const sql = postgres(url, { ssl: "require" });

try {
  await sql.begin(async (tx) => {
    // drizzle migration files can contain multiple statements.
    await tx.unsafe(sqlText);
  });
  console.log(`Applied: ${file}`);
} finally {
  await sql.end({ timeout: 5 });
}

