import { getUserFromRequest, requireAdmin } from "@/lib/api/auth";
import { listMemberRequests } from "@/lib/api/db";
import { jsonForbidden, jsonOk, jsonUnauthorized } from "@/lib/api/responses";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const error = requireAdmin(user);
  if (error) {
    return jsonForbidden(error);
  }

  const requests = await listMemberRequests("pending");
  return jsonOk({ requests });
}
