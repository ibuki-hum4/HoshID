import "server-only";

import { createPostgresRateLimiter } from "@/src/features/oauth/infrastructure/postgres-rate-limiter";

import { prisma } from "../prisma";

const limiter = createPostgresRateLimiter(prisma);

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwarded = forwardedFor?.split(",")[0]?.trim();
  if (firstForwarded) {
    return firstForwarded;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Consumes one slot from a fixed-window rate limit bucket keyed by `key`.
 * Returns a 429 Response when the limit is exceeded, or null when the
 * caller may proceed.
 */
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<Response | null> {
  const decision = await limiter.consume(key, limit, windowSeconds);
  if (decision.allowed) {
    return null;
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((decision.resetAt.getTime() - Date.now()) / 1000),
  );

  return Response.json(
    { error: "rate limit exceeded" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Limit": String(decision.limit),
        "X-RateLimit-Remaining": String(decision.remaining),
      },
    },
  );
}
