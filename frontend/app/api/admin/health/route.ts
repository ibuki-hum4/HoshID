import { getUserFromRequest, requireAdmin } from "@/lib/api/auth";
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

  return jsonOk({ status: "ok" });
}
