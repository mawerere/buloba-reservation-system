import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env.local and set your database URL.");
}

function shouldUseSsl(connectionString: string): boolean {
  return /supabase\.(?:com|co)|sslmode=require|ssl=true/i.test(connectionString);
}

function connectionStringWithoutSslOptions(connectionString: string): string {
  const url = new URL(connectionString);
  for (const option of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert"]) {
    url.searchParams.delete(option);
  }
  return url.toString();
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    ...(shouldUseSsl(databaseUrl)
      ? {
          // Keep the TLS options below authoritative over URL query options.
          connectionString: connectionStringWithoutSslOptions(databaseUrl),
          ssl: {
            rejectUnauthorized: false,
          },
        }
      : { connectionString: databaseUrl }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);