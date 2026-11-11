import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const dbUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "DATABASE_URL or MIGRATION_DATABASE_URL is missing. Copy .env.example to .env.local and fill in the values.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: dbUrl,
  },
  verbose: true,
  strict: true,
});