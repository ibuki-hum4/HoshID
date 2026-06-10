import type { NextRequest } from "next/server";
import { z } from "zod";

import { getUserFromRequest, requireAdmin } from "@/lib/api/auth";
import { getApiUserById, updateApiUser } from "@/lib/api/db";
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

const updateUserSchema = z.object({
  displayName: z.string().trim().max(200).optional(),
  customId: z.string().trim().max(100).optional(),
  role: z.enum(["user", "admin"]).optional(),
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

  const error = requireAdmin(user);
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

  const error = requireAdmin(user);
  if (error) {
    return jsonForbidden(error);
  }

  const params = await context.params;
  const id = params.id ?? "";
  if (!id) {
    return jsonNotFound("user not found");
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
