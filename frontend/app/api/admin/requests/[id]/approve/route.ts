import { hashPassword } from "better-auth/crypto";

import { getUserFromRequest, requireAdmin } from "@/lib/api/auth";
import {
  getMemberRequestById,
  updateMemberRequest,
} from "@/lib/api/db";
import {
  jsonError,
  jsonForbidden,
  jsonNotFound,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/api/responses";
import { sendApprovalCredentialsEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

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

  if (!loginEmail || !password) {
    return jsonError("email and password are required", 400);
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

  const createdUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedLoginEmail,
        name: memberRequest.applicantName || normalizedLoginEmail,
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

    return user;
  });

  const updated = await updateMemberRequest(id, {
    status: "approved",
    decidedAt: new Date(),
    decidedById: adminUser.id,
    userId: createdUser.id,
  });

  try {
    await sendApprovalCredentialsEmail(applicantEmail, normalizedLoginEmail, password);
  } catch (error) {
    return jsonError("failed to send approval email", 500);
  }

  return jsonOk({ request: updated, userId: createdUser.id });
}
