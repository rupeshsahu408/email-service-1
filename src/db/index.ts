import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { postgresJsOptions } from "@/lib/postgres-connection";
import * as schema from "./schema";

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  // eslint-disable-next-line no-var
  var __dbInstance: DbInstance | undefined;
}

export function getDb(): DbInstance {
  if (!globalThis.__dbInstance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    const client = postgres(
      connectionString,
      postgresJsOptions(connectionString, "app")
    );
    globalThis.__dbInstance = drizzle(client, { schema });
  }
  return globalThis.__dbInstance;
}

export { schema };
