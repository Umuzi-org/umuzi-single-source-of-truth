// Singleton Prisma Client instance for use throughout the application.
// In development, we reuse the client across hot reloads to avoid
// exhausting database connections. In production, a single instance is created.
import { PrismaClient } from "./generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create a Prisma adapter using the DATABASE_URL environment variable.
// Prisma 7 requires an adapter for standard PostgreSQL connections.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;