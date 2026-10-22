import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

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

  const adapter = new PrismaPg({
    host: process.env.SUPABASE_DB_HOST,
    port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    database: process.env.SUPABASE_DB_NAME ?? "postgres",
    ssl: { rejectUnauthorized: false },
  });

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
