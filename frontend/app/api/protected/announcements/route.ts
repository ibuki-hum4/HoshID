import { getUserFromRequest } from "@/lib/api/auth";
import { listAnnouncements } from "@/lib/api/db";
import { jsonOk, jsonUnauthorized } from "@/lib/api/responses";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const announcements = await listAnnouncements();
  return jsonOk({ announcements });
}
