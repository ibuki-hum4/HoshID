import { getUserFromRequest, requirePermission } from "@/lib/api/auth";
import { getMemberRequestById, updateMemberRequest } from "@/lib/api/db";
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
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const adminUser = await getUserFromRequest(request);
  if (!adminUser) {
    return jsonUnauthorized("invalid token");
  }

  const error = await requirePermission(adminUser, PERMISSIONS.MANAGE_REQUESTS);
  if (error) {
    return jsonForbidden(error);
  }

  const params = await context.params;
  const id = params.id ?? "";
  if (!id) {
    return jsonNotFound("request not found");
  }

  const memberRequest = await getMemberRequestById(id);
  if (!memberRequest) {
    return jsonNotFound("request not found");
  }

  if (memberRequest.status !== "pending") {
    return jsonError("request already processed", 409);
  }

  const updated = await updateMemberRequest(id, {
    status: "rejected",
    decidedAt: new Date(),
    decidedById: adminUser.id,
  });

  return jsonOk({ request: updated });
}
