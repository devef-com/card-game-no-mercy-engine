import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/src/db";

let authInstance: ReturnType<typeof betterAuth> | null = null;

export function getAuth() {
  if (authInstance) return authInstance;

  const db = getDb();

  authInstance = betterAuth({
    trustedOrigins: [process.env.NEXTAUTH_URL || "", "http://10.0.0.25:3000"],
    database: drizzleAdapter(db, {
      provider: "sqlite",
    }),
    emailAndPassword: {
      enabled: true,
    },
  });

  return authInstance;
}
