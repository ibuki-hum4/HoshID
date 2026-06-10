import { hashPassword } from "better-auth/crypto";

import { getUserFromRequest, requireAdmin } from "@/lib/api/auth";
import { getMemberRequestById } from "@/lib/api/db";
import { isPrismaErrorCode } from "@/lib/api/prisma-errors";
import {
  jsonConflict,
  jsonError,
  jsonForbidden,
  jsonNotFound,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/api/responses";
import { sendApprovalCredentialsEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const adminUser = await getUserFromRequest(request);
  if (!adminUser) {
    return jsonUnauthorized("invalid token");
  }

  const error = requireAdmin(adminUser);
  if (error) {
    return jsonForbidden(error);
  }

  const params = await context.params;
  const id = params.id ?? "";
  if (!id) {
    return jsonNotFound("request not found");
  }

  const body = await request.json().catch(() => ({}));
  const loginEmail = typeof body?.email === "string" ? body.email.trim() : "";
  const normalizedLoginEmail = loginEmail.toLowerCase();
  const password = typeof body?.password === "string" ? body.password : "";
  const usernameInput =
    typeof body?.username === "string" ? body.username.trim() : "";

  if (!loginEmail || !password) {
    return jsonError("email and password are required", 400);
  }

  let normalizedUsername = "";
  if (usernameInput) {
    normalizedUsername = normalizeUsername(usernameInput);
    const formatError = validateUsernameFormat(normalizedUsername);
    if (formatError) {
      return jsonError(formatError, 400);
    }
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedLoginEmail,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (existingUser) {
    return jsonError("email already in use", 409);
  }

  const memberRequest = await getMemberRequestById(id);
  if (!memberRequest) {
    return jsonNotFound("request not found");
  }

  if (memberRequest.status !== "pending") {
    return jsonError("request already processed", 409);
  }

  const applicantEmail = memberRequest.applicantEmail?.trim();
  if (!applicantEmail) {
    return jsonError("applicant email is missing", 400);
  }

  const passwordHash = await hashPassword(password);

  let result: { user: { id: string }; request: unknown };
  try {
    result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedLoginEmail,
          name: memberRequest.applicantName || normalizedLoginEmail,
          ...(normalizedUsername
            ? { username: normalizedUsername, displayUsername: normalizedUsername }
            : {}),
          role: "user",
          status: "active",
          emailVerified: false,
        },
      });

      await tx.account.create({
        data: {
          userId: user.id,
          providerId: "credential",
          accountId: user.id,
          password: passwordHash,
        },
      });

      const request = await tx.memberRequest.update({
        where: { id },
        data: {
          status: "approved",
          decidedAt: new Date(),
          decidedById: adminUser.id,
          userId: user.id,
        },
      });

      return { user, request };
    });
  } catch (caught) {
    if (isPrismaErrorCode(caught, "P2002")) {
      return jsonConflict("custom id already exists");
    }
    throw caught;
  }

  const { user: createdUser, request: updatedRequest } = result;

  try {
    await sendApprovalCredentialsEmail(applicantEmail, normalizedLoginEmail, password);
  } catch (_error) {
    return jsonError("failed to send approval email", 500);
  }

  return jsonOk({ request: updatedRequest, userId: createdUser.id });
}
