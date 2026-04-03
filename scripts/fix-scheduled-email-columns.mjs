import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const db = postgres(url, { ssl: "require" });

function names(rows) {
  return rows.map((r) => String(r.column_name));
}

try {
  const before = await db.unsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scheduled_emails' ORDER BY ordinal_position"
  );
  const beforeCols = names(before);
  console.log("scheduled_emails columns BEFORE:");
  console.log(beforeCols.join("\n"));

  await db.unsafe(
    "ALTER TABLE scheduled_emails ADD COLUMN IF NOT EXISTS cc_addr text, ADD COLUMN IF NOT EXISTS bcc_addr text"
  );
  await db.unsafe(
    "UPDATE scheduled_emails SET cc_addr = COALESCE(cc_addr, ''), bcc_addr = COALESCE(bcc_addr, '')"
  );
  await db.unsafe(
    "ALTER TABLE scheduled_emails ALTER COLUMN cc_addr SET DEFAULT '', ALTER COLUMN bcc_addr SET DEFAULT ''"
  );
  await db.unsafe(
    "ALTER TABLE scheduled_emails ALTER COLUMN cc_addr SET NOT NULL, ALTER COLUMN bcc_addr SET NOT NULL"
  );

  const after = await db.unsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scheduled_emails' ORDER BY ordinal_position"
  );
  const afterCols = names(after);
  console.log("\nscheduled_emails columns AFTER:");
  console.log(afterCols.join("\n"));
} finally {
  await db.end({ timeout: 5 });
}
