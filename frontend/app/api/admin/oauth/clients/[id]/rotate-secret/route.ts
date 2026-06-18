import type { NextRequest } from "next/server";

import { getUserFromRequest, requirePermission } from "@/lib/api/auth";
import {
  getOAuthClientByClientId,
  updateOAuthClientSecret,
} from "@/lib/api/db";
import {
  generateClientSecret,
  hashClientSecret,
  toPublicOAuthClient,
} from "@/lib/api/oauth-clients";
import {
  jsonError,
  jsonForbidden,
  jsonNotFound,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/api/responses";
import { PERMISSIONS } from "@/src/features/rbac/permissions";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const error = await requirePermission(user, PERMISSIONS.MANAGE_APPLICATIONS);
  if (error) {
    return jsonForbidden(error);
  }

  const params = await context.params;
  const existing = await getOAuthClientByClientId(params.id);
  if (!existing) {
    return jsonNotFound("client not found");
  }

  if (existing.public) {
    return jsonError("public clients do not have a secret to rotate", 400);
  }

  const clientSecret = generateClientSecret();
  const hashedSecret = await hashClientSecret(clientSecret);
  const updated = await updateOAuthClientSecret(params.id, hashedSecret);
  if (!updated) {
    return jsonNotFound("client not found");
  }

  return jsonOk({ client: toPublicOAuthClient(updated), clientSecret });
}
