import type { PrismaClient } from "@prisma/client";

import type { RateLimitDecision, RateLimiter } from "./rate-limit";

type RateLimitRow = {
  count: number;
  windowStart: Date;
  expiresAt: Date;
};

function windowStartFor(now: Date, windowSeconds: number): Date {
  const windowStartMs = Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000;
  return new Date(windowStartMs);
}

export function createPostgresRateLimiter(prisma: PrismaClient): RateLimiter {
  return {
    async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
      const now = new Date();
      const windowStart = windowStartFor(now, windowSeconds);
      const resetAt = new Date(windowStart.getTime() + windowSeconds * 1000);

      const [row] = await prisma.$queryRaw<RateLimitRow[]>`
        INSERT INTO "rate_limit_bucket" (
          "key",
          "windowStart",
          "count",
          "expiresAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${key},
          ${windowStart},
          1,
          ${resetAt},
          NOW(),
          NOW()
        )
        ON CONFLICT ("key") DO UPDATE
        SET
          "count" = CASE
            WHEN "rate_limit_bucket"."windowStart" = EXCLUDED."windowStart"
              THEN "rate_limit_bucket"."count" + 1
            ELSE 1
          END,
          "windowStart" = EXCLUDED."windowStart",
          "expiresAt" = EXCLUDED."expiresAt",
          "updatedAt" = NOW()
        RETURNING "count", "windowStart", "expiresAt";
      `;

      const currentCount = row?.count ?? 1;
      return {
        allowed: currentCount <= limit,
        limit,
        remaining: Math.max(0, limit - currentCount),
        resetAt: row?.expiresAt ?? resetAt,
      };
    },
  };
}
