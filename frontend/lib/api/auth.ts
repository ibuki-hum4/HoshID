import "server-only";

import type { User } from "@prisma/client";
import { jwtVerify, SignJWT } from "jose";

import {
  ALL_PERMISSIONS,
  hasAnyPermissionBit,
  hasPermissionBit,
} from "@/src/features/rbac/permissions";

export interface AuthUser
  extends Pick<User, "id" | "email" | "role" | "status"> {}

interface DashboardTokenPayload {
  id: string;
  email: string;
  role: string;
  status: string;
  [key: string]: unknown;
}

const DASHBOARD_TOKEN_ISSUER = "hoshid-dashboard";
const DASHBOARD_TOKEN_AUDIENCE = "hoshid-dashboard";

function getDashboardTokenSecret(): Uint8Array {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
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
    const { payload } = await jwtVerify(token, getDashboardTokenSecret(), {
      algorithms: ["HS256"],
      issuer: DASHBOARD_TOKEN_ISSUER,
      audience: DASHBOARD_TOKEN_AUDIENCE,
    });

    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId || typeof payload.email !== "string") {
      return null;
    }

    // Re-fetch the user so role/status reflect the current database state,
    // not whatever was embedded in the token at issuance time.
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user || user.email !== payload.email) {
      return null;
    }

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

/**
 * Resolves a user's effective permission bitmask via their assigned Role
 * (matched by `Role.customId === user.role`). The literal "admin" role
 * always resolves to every permission, even if its DB row is missing, so
 * the original superuser role can never be locked out by a bad migration
 * or a deleted/corrupted role row.
 */
export async function getPermissionBitmask(user: AuthUser): Promise<number> {
  if (user.role === "admin") {
    return ALL_PERMISSIONS;
  }

  const { prisma } = await import("@/lib/prisma");
  const role = await prisma.role.findUnique({
    where: { customId: user.role },
    select: { permissionBitmask: true },
  });

  return role?.permissionBitmask ?? 0;
}

export async function requirePermission(
  user: AuthUser,
  bit: number,
): Promise<string | null> {
  const bitmask = await getPermissionBitmask(user);
  if (!hasPermissionBit(bitmask, bit)) {
    return "insufficient permissions";
  }
  return null;
}

export async function requireAnyPermission(
  user: AuthUser,
  bits: number[],
): Promise<string | null> {
  const bitmask = await getPermissionBitmask(user);
  if (!hasAnyPermissionBit(bitmask, bits)) {
    return "insufficient permissions";
  }
  return null;
}

export async function issueDashboardToken(
  payload: DashboardTokenPayload,
): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.id)
    .setIssuer(DASHBOARD_TOKEN_ISSUER)
    .setAudience(DASHBOARD_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getDashboardTokenSecret());

  return token;
}
