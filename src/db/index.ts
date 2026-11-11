import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env.local and set your database URL.");
}

function useSsl(connectionString: string): boolean {
  return /supabase\.(?:com|co)|sslmode=require|ssl=true/i.test(connectionString);
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ...(useSsl(databaseUrl)
      ? {
          ssl: {
            rejectUnauthorized: false,
          },
        }
      : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);