import { z } from "zod";

import { getUserFromRequest, requirePermission } from "@/lib/api/auth";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
} from "@/lib/api/db";
import {
  jsonError,
  jsonForbidden,
  jsonNotFound,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/api/responses";
import { PERMISSIONS } from "@/src/features/rbac/permissions";

export const runtime = "nodejs";

const announcementSchema = z.object({
  title: z.string().trim().min(1).max(500),
  status: z.string().trim().min(1).max(50),
});

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const error = await requirePermission(user, PERMISSIONS.MANAGE_ANNOUNCEMENTS);
  if (error) {
    return jsonForbidden(error);
  }

  const announcements = await listAnnouncements();
  return jsonOk({ announcements });
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const error = await requirePermission(user, PERMISSIONS.MANAGE_ANNOUNCEMENTS);
  if (error) {
    return jsonForbidden(error);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (_err) {
    return jsonError("invalid json", 400);
  }

  const parsed = announcementSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("invalid payload", 400);
  }

  const created = await createAnnouncement(
    parsed.data.title,
    parsed.data.status,
  );
  return jsonOk(created, 201);
}

export async function PUT(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const error = await requirePermission(user, PERMISSIONS.MANAGE_ANNOUNCEMENTS);
  if (error) {
    return jsonForbidden(error);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  if (!id) {
    return jsonError("missing id", 400);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (_err) {
    return jsonError("invalid json", 400);
  }

  const parsed = announcementSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("invalid payload", 400);
  }

  const updated = await updateAnnouncement(
    id,
    parsed.data.title,
    parsed.data.status,
  );
  if (!updated) {
    return jsonNotFound("announcement not found");
  }

  return jsonOk(updated);
}

export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const error = await requirePermission(user, PERMISSIONS.MANAGE_ANNOUNCEMENTS);
  if (error) {
    return jsonForbidden(error);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  if (!id) {
    return jsonError("missing id", 400);
  }

  const deleted = await deleteAnnouncement(id);
  if (!deleted) {
    return jsonNotFound("announcement not found");
  }

  return jsonOk({ result: "deleted" });
}
