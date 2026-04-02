import "dotenv/config";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import postgres from "postgres";

const ADMIN_EMAIL = "admin@sendora.com";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD?.trim();
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

if (!ADMIN_PASSWORD) {
  console.error("ADMIN_SEED_PASSWORD is required and cannot be empty.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: "require" });

try {
  const [localPart, domain] = ADMIN_EMAIL.split("@");
  if (!localPart || domain !== "sendora.com") {
    throw new Error("Invalid default admin email.");
  }

  const passwordHash = await argon2.hash(ADMIN_PASSWORD, { type: argon2.argon2id });
  const recoveryKeyRaw = randomBytes(16).toString("hex");
  const recoveryKeyHash = await argon2.hash(recoveryKeyRaw, { type: argon2.argon2id });

  await sql`
    INSERT INTO users (local_part, password_hash, recovery_key_hash, is_admin)
    VALUES (${localPart}, ${passwordHash}, ${recoveryKeyHash}, true)
    ON CONFLICT (local_part)
    DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      is_admin = true,
      last_login_at = users.last_login_at
  `;

  console.log(`Seeded admin account: ${ADMIN_EMAIL}`);
} finally {
  await sql.end({ timeout: 5 });
}
