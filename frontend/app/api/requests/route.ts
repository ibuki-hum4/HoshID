import { createMemberRequest } from "@/lib/api/db";
import { jsonError, jsonOk } from "@/lib/api/responses";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const applicantEmail = typeof body?.email === "string" ? body.email.trim() : "";
  const normalizedEmail = applicantEmail.toLowerCase();
  const applicantName = typeof body?.name === "string" ? body.name.trim() : "";

  if (!applicantEmail) {
    return jsonError("email is required", 400);
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (existingUser) {
    return jsonError("email already registered", 409);
  }

  const existingRequest = await prisma.memberRequest.findFirst({
    where: {
      applicantEmail: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
      status: "pending",
    },
    select: { id: true },
  });

  if (existingRequest) {
    return jsonError("request already submitted", 409);
  }

  const created = await createMemberRequest(normalizedEmail, applicantName || undefined);
  return jsonOk({ request: created }, 201);
}
