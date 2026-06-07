import "server-only";

import type { User } from "@prisma/client";
import { SignJWT } from "jose";

export interface AuthUser extends Pick<User, "id" | "email" | "role" | "status"> {}

interface DashboardTokenPayload {
  id: string;
  email: string;
  role: string;
  status: string;
  [key: string]: unknown;
}

export async function getUserFromRequest(
  request: Request,
): Promise<AuthUser | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    // Verify JWT token using jose or similar
    // For now, this is a placeholder that should be implemented
    // with actual JWT verification from better-auth
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    const userId = payload.sub ?? payload.id;
    if (!userId || !payload.email) {
      return null;
    }

    // Fetch user from database
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, status: true },
    });

    return user;
  } catch {
    return null;
  }
}

export function requireAdmin(user: AuthUser): string | null {
  if (user.role !== "admin") {
    return "admin role required";
  }
  return null;
}

export async function issueDashboardToken(
  payload: DashboardTokenPayload,
): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.BETTER_AUTH_SECRET || "dev-secret",
  );

  const token = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.id)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);

  return token;
}
