import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require" });
try {
  const rows = await sql.unsafe(
    "select to_regclass('public.confidential_messages') as reg"
  );
  console.log(rows);
} finally {
  await sql.end({ timeout: 5 });
}

