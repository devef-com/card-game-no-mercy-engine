import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import db from "@/src/db/index";

export const auth = betterAuth({
  trustedOrigins: [process.env.NEXTAUTH_URL || "", "http://10.0.0.25:3000"],
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
});
