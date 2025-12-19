import "server-only";
import { drizzle } from "drizzle-orm/libsql";

const { DATABASE_URL, DATABASE_AUTH_TOKEN } = process.env;

if (!DATABASE_URL) {
  throw new Error("Missing env: DATABASE_URL");
}

if (!DATABASE_AUTH_TOKEN) {
  throw new Error("Missing env: DATABASE_AUTH_TOKEN");
}

const db = drizzle({
  connection: {
    url: DATABASE_URL,
    authToken: DATABASE_AUTH_TOKEN,
  },
});

export default db;
