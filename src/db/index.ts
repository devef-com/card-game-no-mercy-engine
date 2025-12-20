import "server-only";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const db = drizzle({
  connection: {
    url:
      process.env.DATABASE_URL ||
      `file:${process.env.DB_FILE_PATH || "sqlite.db"}`,
  },
  schema,
});

export default db;
