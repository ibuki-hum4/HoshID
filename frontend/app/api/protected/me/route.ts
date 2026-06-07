import { getUserFromRequest } from "@/lib/api/auth";
import { jsonOk, jsonUnauthorized } from "@/lib/api/responses";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  return jsonOk({
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
  });
}
