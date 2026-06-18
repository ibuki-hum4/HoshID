import { z } from "zod";

import {
  getUserFromRequest,
  requireAnyPermission,
  requirePermission,
} from "@/lib/api/auth";
import {
  countActiveUsersWithPermission,
  countUsersWithRole,
  createRole,
  deleteRole,
  getRoleById,
  listRoles,
  updateRole,
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
import { ALL_PERMISSIONS, PERMISSIONS } from "@/src/features/rbac/permissions";

export const runtime = "nodejs";

const roleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  customId: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional().default(""),
  permissionBitmask: z.number().int().min(0),
});

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const error = await requireAnyPermission(user, [
    PERMISSIONS.MANAGE_ROLES,
    PERMISSIONS.ASSIGN_ROLES,
  ]);
  if (error) {
    return jsonForbidden(error);
  }

  const roles = await listRoles();
  return jsonOk({ roles });
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const error = await requirePermission(user, PERMISSIONS.MANAGE_ROLES);
  if (error) {
    return jsonForbidden(error);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (_err) {
    return jsonError("invalid json", 400);
  }

  const parsed = roleSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("invalid payload", 400);
  }

  try {
    const created = await createRole(
      parsed.data.name,
      parsed.data.customId,
      parsed.data.description,
      parsed.data.permissionBitmask & ALL_PERMISSIONS,
    );
    return jsonOk({ role: created }, 201);
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      return jsonConflict("custom id already exists");
    }
    throw error;
  }
}

export async function PUT(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const error = await requirePermission(user, PERMISSIONS.MANAGE_ROLES);
  if (error) {
    return jsonForbidden(error);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  if (!id) {
    return jsonError("missing id", 400);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (_err) {
    return jsonError("invalid json", 400);
  }

  const parsed = roleSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("invalid payload", 400);
  }

  const existing = await getRoleById(id);
  if (!existing) {
    return jsonNotFound("role not found");
  }

  if (existing.isProtected && parsed.data.customId !== existing.customId) {
    return jsonForbidden("built-in role custom id cannot be changed");
  }

  const nextBitmask = parsed.data.permissionBitmask & ALL_PERMISSIONS;
  const losesAssignRoles =
    (existing.permissionBitmask & PERMISSIONS.ASSIGN_ROLES) ===
      PERMISSIONS.ASSIGN_ROLES &&
    (nextBitmask & PERMISSIONS.ASSIGN_ROLES) !== PERMISSIONS.ASSIGN_ROLES;

  if (losesAssignRoles) {
    const remaining = await countActiveUsersWithPermission(
      PERMISSIONS.ASSIGN_ROLES,
      { excludeRoleCustomId: existing.customId },
    );
    if (remaining === 0) {
      return jsonConflict(
        "cannot remove role-assignment permission: no other active user could assign roles afterward",
      );
    }
  }

  try {
    const updated = await updateRole(
      id,
      parsed.data.name,
      parsed.data.customId,
      parsed.data.description,
      nextBitmask,
    );
    if (!updated) {
      return jsonNotFound("role not found");
    }

    return jsonOk({ role: updated });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      return jsonConflict("custom id already exists");
    }
    throw error;
  }
}

export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const error = await requirePermission(user, PERMISSIONS.MANAGE_ROLES);
  if (error) {
    return jsonForbidden(error);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  if (!id) {
    return jsonError("missing id", 400);
  }

  const existing = await getRoleById(id);
  if (!existing) {
    return jsonNotFound("role not found");
  }

  if (existing.isProtected) {
    return jsonForbidden("built-in role cannot be deleted");
  }

  const usersWithRole = await countUsersWithRole(existing.customId);
  if (usersWithRole > 0) {
    return jsonConflict(
      `role is still assigned to ${usersWithRole} user(s); reassign them first`,
    );
  }

  const deleted = await deleteRole(id);
  if (!deleted) {
    return jsonNotFound("role not found");
  }

  return jsonOk({ result: "deleted" });
}
