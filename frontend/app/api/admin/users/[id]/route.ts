import type { NextRequest } from "next/server";
import { z } from "zod";

import { getUserFromRequest, requirePermission } from "@/lib/api/auth";
import {
  countActiveUsersWithPermission,
  getApiUserById,
  getRoleByCustomId,
  updateApiUser,
} from "@/lib/api/db";
import { isPrismaErrorCode } from "@/lib/api/prisma-errors";
import {
  jsonConflict,
  jsonError,
  jsonForbidden,
  jsonNotFound,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/api/responses";
import { PERMISSIONS } from "@/src/features/rbac/permissions";

export const runtime = "nodejs";

const updateUserSchema = z.object({
  displayName: z.string().trim().max(200).optional(),
  customId: z.string().trim().max(100).optional(),
  role: z.string().trim().min(1).max(100).optional(),
  status: z.enum(["active", "suspended", "archived"]).optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const error = await requirePermission(user, PERMISSIONS.MANAGE_USERS);
  if (error) {
    return jsonForbidden(error);
  }

  const params = await context.params;
  const id = params.id ?? "";
  if (!id) {
    return jsonNotFound("user not found");
  }

  const record = await getApiUserById(id);
  if (!record) {
    return jsonNotFound("user not found");
  }

  return jsonOk(record);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (_err) {
    return jsonError("invalid json", 400);
  }

  const parsed = updateUserSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("invalid payload", 400);
  }

  const { displayName, customId, role, status } = parsed.data;

  // Changing what a user is allowed to do (role) is a more sensitive
  // action than editing their profile fields, so it requires its own
  // permission rather than riding along with MANAGE_USERS. A request that
  // touches no recognized field still needs at least MANAGE_USERS so this
  // route can't be used to probe user existence without any permission.
  const requiredPermissions = [
    ...(role !== undefined ? [PERMISSIONS.ASSIGN_ROLES] : []),
    PERMISSIONS.MANAGE_USERS,
  ];

  const permissionError = await requireAllPermissions(
    user,
    requiredPermissions,
  );
  if (permissionError) {
    return jsonForbidden(permissionError);
  }

  const params = await context.params;
  const id = params.id ?? "";
  if (!id) {
    return jsonNotFound("user not found");
  }

  if (role !== undefined) {
    const targetRole = await getRoleByCustomId(role);
    if (!targetRole) {
      return jsonError("unknown role", 400);
    }
  }

  const target = await getApiUserById(id);
  if (!target) {
    return jsonNotFound("user not found");
  }

  const losesActiveAssignRoles =
    target.status === "active" &&
    ((status !== undefined && status !== "active") ||
      (role !== undefined && role !== target.role));

  if (losesActiveAssignRoles) {
    const targetRole = await getRoleByCustomId(target.role);
    const targetHadAssignRoles =
      target.role === "admin" ||
      ((targetRole?.permissionBitmask ?? 0) & PERMISSIONS.ASSIGN_ROLES) ===
        PERMISSIONS.ASSIGN_ROLES;

    if (targetHadAssignRoles) {
      const remaining = await countActiveUsersWithPermission(
        PERMISSIONS.ASSIGN_ROLES,
        { excludeUserId: id },
      );
      if (remaining === 0) {
        return jsonConflict(
          "cannot update the last active user who can assign roles",
        );
      }
    }
  }

  const data = {
    ...(displayName !== undefined ? { displayUsername: displayName } : {}),
    ...(customId !== undefined ? { username: customId } : {}),
    ...(role !== undefined ? { role } : {}),
    ...(status !== undefined ? { status } : {}),
  };

  try {
    const updated = await updateApiUser(id, data);
    if (!updated) {
      return jsonNotFound("user not found");
    }
    return jsonOk({ member: updated });
  } catch (caught) {
    if (isPrismaErrorCode(caught, "P2002")) {
      return jsonConflict("custom id already exists");
    }
    throw caught;
  }
}

async function requireAllPermissions(
  user: Parameters<typeof requirePermission>[0],
  bits: number[],
): Promise<string | null> {
  for (const bit of bits) {
    const error = await requirePermission(user, bit);
    if (error) {
      return error;
    }
  }
  return null;
}
