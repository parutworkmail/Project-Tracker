import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { CONNECT_TIMEOUT_MS, RetryingPool } from "@/lib/retryingPool";

export class DbUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DbUnavailableError";
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const requiredEnvVars = [
  "SUPABASE_DB_HOST",
  "SUPABASE_DB_USER",
  "SUPABASE_DB_PASSWORD",
] as const;

function createPrismaClient(): PrismaClient {
  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      throw new DbUnavailableError(
        `Missing required environment variable: ${key}. Check your .env file or Vercel project settings.`
      );
    }
  }

  const pool = new RetryingPool({
    host: process.env.SUPABASE_DB_HOST,
    port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    database: process.env.SUPABASE_DB_NAME ?? "postgres",
    // A hung connect fails after this instead of waiting for the platform
    // timeout; RetryingPool then retries once (see retryingPool.ts).
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    // Only a local throwaway test database (SUPABASE_DB_SSL=disable) skips TLS.
    // ecdhCurve excludes the post-quantum hybrid key share that Node 24+ /
    // OpenSSL 3.5 sends by default: its oversized ClientHello is silently
    // dropped by some networks, so the Postgres TLS handshake never finishes.
    ssl:
      process.env.SUPABASE_DB_SSL === "disable"
        ? false
        : {
            rejectUnauthorized: false,
            ecdhCurve: "X25519:prime256v1:secp384r1",
          },
  });

  // Without a listener, an error on an idle connection (e.g. the network
  // dropping it) would crash the Node process. The pool discards the broken
  // client and opens a fresh one on the next query.
  pool.on("error", (error) => {
    console.error("Database pool error (connection will be replaced):", error.message);
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}

let lazyPrisma: PrismaClient | undefined = globalForPrisma.prisma;

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    if (!lazyPrisma) {
      lazyPrisma = createPrismaClient();

      if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = lazyPrisma;
      }
    }

    return Reflect.get(lazyPrisma, prop, receiver);
  },
});
