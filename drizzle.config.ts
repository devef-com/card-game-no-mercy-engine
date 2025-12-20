import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config();

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      `file:${process.env.DB_FILE_PATH || "sqlite.db"}`,
  },
});
