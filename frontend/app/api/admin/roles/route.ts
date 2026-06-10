import { z } from "zod";

import { getUserFromRequest, requireAdmin } from "@/lib/api/auth";
import { createRole, deleteRole, listRoles, updateRole } from "@/lib/api/db";
import { isPrismaErrorCode } from "@/lib/api/prisma-errors";
import {
  jsonConflict,
  jsonError,
  jsonForbidden,
  jsonNotFound,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/api/responses";

export const runtime = "nodejs";

const roleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  customId: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional().default(""),
  permissionBitmask: z.number().int(),
});

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const error = requireAdmin(user);
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

  const error = requireAdmin(user);
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
      parsed.data.permissionBitmask,
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

  const error = requireAdmin(user);
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

  try {
    const updated = await updateRole(
      id,
      parsed.data.name,
      parsed.data.customId,
      parsed.data.description,
      parsed.data.permissionBitmask,
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

  const error = requireAdmin(user);
  if (error) {
    return jsonForbidden(error);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  if (!id) {
    return jsonError("missing id", 400);
  }

  const deleted = await deleteRole(id);
  if (!deleted) {
    return jsonNotFound("role not found");
  }

  return jsonOk({ result: "deleted" });
}
