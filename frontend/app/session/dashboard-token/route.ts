import { auth } from "@/lib/auth";
import { issueDashboardToken } from "@/lib/api/auth";
import { ensureApiUser } from "@/lib/api/db";
import { jsonError, jsonOk, jsonUnauthorized } from "@/lib/api/responses";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user;
  if (!user?.id || !user.email) {
    return jsonUnauthorized("unauthorized");
  }

  try {
    const apiUser = await ensureApiUser(user.id, user.email);
    const token = await issueDashboardToken({
      id: apiUser.id,
      email: apiUser.email,
      role: apiUser.role,
      status: apiUser.status,
    });

    return jsonOk({
      token,
      role: apiUser.role,
      status: apiUser.status,
    });
  } catch (err) {
    return jsonError("failed to issue dashboard token", 500);
  }
}
