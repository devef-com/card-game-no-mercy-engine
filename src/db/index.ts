import "server-only";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

let db: LibSQLDatabase<typeof schema> | null = null;

export function getDb() {
  if (db) return db;

  const url =
    process.env.DATABASE_URL ??
    `file:${process.env.DB_FILE_PATH ?? "/app/data/sqlite.db"}`;

  db = drizzle({
    connection: { url },
    schema,
  });

  return db;
}
