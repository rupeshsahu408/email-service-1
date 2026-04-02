import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    /** Prefer Neon direct (non-pooler) URL for migrations — see `src/lib/postgres-connection.ts`. */
    url:
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.DATABASE_URL_DIRECT ||
      process.env.DATABASE_URL!,
  },
});
