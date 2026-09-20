import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

function createPrismaClient() {
  // Prisma 7 removed the built-in connection engine, so a driver adapter is
  // required — `new PrismaClient()` with no argument throws.
  //
  // The adapter inherits node-postgres' pool defaults, and node-postgres waits
  // forever for a connection by default. Prisma 6 used to time out after 5s, so
  // that is restored here rather than letting requests hang on a dead database.
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 5_000,
  });

  return new PrismaClient({ adapter });
}

// Dev hot-reload re-evaluates modules, which would leak a connection pool per
// reload without caching the client on globalThis.
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
