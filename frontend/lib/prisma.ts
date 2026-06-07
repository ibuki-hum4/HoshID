import "server-only";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Load .env.development at runtime when present so local `next start` picks up
// the same environment values that `next build` may have used. This helps when
// running the built server locally in development/debug scenarios.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require("dotenv");
  const path = require("path");
  const envPath = path.resolve(process.cwd(), ".env.development");
  dotenv.config({ path: envPath });
} catch (e) {
  // best-effort; if dotenv is not available we silently continue
}

declare global {
  var prisma: PrismaClient | undefined;
}

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/postgres?schema=public";

const adapter = new PrismaPg({ connectionString });

export const prisma = globalThis.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}