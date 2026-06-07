import { type NextRequest } from "next/server";

import { getUserFromRequest, requireAdmin } from "@/lib/api/auth";
import { getApiUserById } from "@/lib/api/db";
import {
  jsonForbidden,
  jsonNotFound,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/api/responses";

export const runtime = "nodejs";

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
