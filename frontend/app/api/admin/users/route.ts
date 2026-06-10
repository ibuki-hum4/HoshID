import { getUserFromRequest, requireAdmin } from "@/lib/api/auth";
import { listApiUsers } from "@/lib/api/db";
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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;

  const users = await listApiUsers(status);
  return jsonOk({ users });
}
