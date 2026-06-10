import { createMemberRequest } from "@/lib/api/db";
import { enforceRateLimit, getClientIp } from "@/lib/api/rate-limit";
import { jsonError, jsonOk } from "@/lib/api/responses";
import { prisma } from "@/lib/prisma";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimited = await enforceRateLimit(
    `member-request:ip:${ip}`,
    5,
    3600,
  );
  if (rateLimited) {
    return rateLimited;
  }

  const body = await request.json().catch(() => ({}));
  const applicantEmail =
    typeof body?.email === "string" ? body.email.trim() : "";
  const normalizedEmail = applicantEmail.toLowerCase();
  const applicantName = typeof body?.name === "string" ? body.name.trim() : "";
  const requestedUsernameRaw =
    typeof body?.username === "string" ? body.username.trim() : "";

  if (!applicantEmail) {
    return jsonError("email is required", 400);
  }

  let normalizedUsername = "";
  if (requestedUsernameRaw) {
    normalizedUsername = normalizeUsername(requestedUsernameRaw);
    const formatError = validateUsernameFormat(normalizedUsername);
    if (formatError) {
      return jsonError(formatError, 400);
    }
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

  if (normalizedUsername) {
    const existingUsername = await prisma.user.findFirst({
      where: { username: normalizedUsername },
      select: { id: true },
    });
    if (existingUsername) {
      return jsonError("custom id already in use", 409);
    }

    const existingUsernameRequest = await prisma.memberRequest.findFirst({
      where: { requestedUsername: normalizedUsername, status: "pending" },
      select: { id: true },
    });
    if (existingUsernameRequest) {
      return jsonError("custom id already requested", 409);
    }
  }

  const created = await createMemberRequest(
    normalizedEmail,
    applicantName || undefined,
    normalizedUsername || undefined,
  );
  return jsonOk({ request: created }, 201);
}
