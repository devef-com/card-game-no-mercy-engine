import "server-only";
import { drizzle } from "drizzle-orm/libsql";

const { DATABASE_URL, DATABASE_AUTH_TOKEN } = process.env;

if (!DATABASE_URL) {
  throw new Error("Missing env: DATABASE_URL");
}

if (!DATABASE_AUTH_TOKEN) {
  throw new Error("Missing env: DATABASE_AUTH_TOKEN");
}

import * as schema from "./schema";

const db = drizzle({
  connection: {
    url: DATABASE_URL,
    authToken: DATABASE_AUTH_TOKEN,
  },
  schema,
});

export default db;
