import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Load .env.development at runtime when present so local `next start` picks up
// the same environment values that `next build` may have used. This helps when
// running the built server locally in development/debug scenarios.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require("dotenv");
  const path = require("node:path");
  const envPath = path.resolve(process.cwd(), ".env.development");
  dotenv.config({ path: envPath });
} catch (_e) {
  // best-effort; if dotenv is not available we silently continue
}

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/postgres?schema=public";

const adapter = new PrismaPg({ connectionString });

export const prisma = globalThis.prismaGlobal ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
