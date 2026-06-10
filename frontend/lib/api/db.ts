import "server-only";

import type { Announcement, MemberRequest, Role, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isPrismaErrorCode } from "./prisma-errors";

export async function listApiUsers(status?: string): Promise<User[]> {
  return prisma.user.findMany({
    where: status ? { status } : undefined,
    orderBy: { id: "asc" },
  });
}

export async function getApiUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id },
  });
}

export async function updateApiUser(
  id: string,
  data: Partial<Pick<User, "username" | "displayUsername" | "role" | "status">>,
): Promise<User | null> {
  try {
    return await prisma.user.update({
      where: { id },
      data,
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return null;
    }
    throw error;
  }
}

export async function getApiUserByIdOrEmail(
  id: string,
  email: string,
): Promise<User | null> {
  return prisma.user.findFirst({
    where: {
      OR: [{ id }, { email }],
    },
  });
}

export async function ensureApiUser(id: string, email: string): Promise<User> {
  return prisma.user.upsert({
    where: { id },
    create: {
      id,
      email,
      role: "user",
      status: "active",
      name: email,
    },
    update: {},
  });
}

export async function listAnnouncements(): Promise<Announcement[]> {
  return prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function listMemberRequests(
  status: string = "pending",
): Promise<MemberRequest[]> {
  return prisma.memberRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });
}

export async function getMemberRequestById(
  id: string,
): Promise<MemberRequest | null> {
  return prisma.memberRequest.findUnique({
    where: { id },
  });
}

export async function createMemberRequest(
  applicantEmail: string,
  applicantName?: string,
  requestedUsername?: string,
): Promise<MemberRequest> {
  return prisma.memberRequest.create({
    data: {
      applicantEmail,
      applicantName: applicantName || null,
      requestedUsername: requestedUsername || null,
      status: "pending",
    },
  });
}

export async function updateMemberRequest(
  id: string,
  data: Partial<Pick<MemberRequest,
    "status" |
    "decidedAt" |
    "decidedById" |
    "userId" |
    "applicantEmail" |
    "applicantName"
  >>,
): Promise<MemberRequest | null> {
  try {
    return await prisma.memberRequest.update({
      where: { id },
      data,
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return null;
    }
    throw error;
  }
}

export async function createAnnouncement(
  title: string,
  status: string,
): Promise<Announcement> {
  return prisma.announcement.create({
    data: {
      title,
      status,
      content: "",
    },
  });
}

export async function updateAnnouncement(
  id: string,
  title: string,
  status: string,
): Promise<Announcement | null> {
  try {
    return await prisma.announcement.update({
      where: { id },
      data: {
        title,
        status,
      },
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return null;
    }
    throw error;
  }
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  try {
    await prisma.announcement.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return false;
    }
    throw error;
  }
}

export async function listRoles(): Promise<Role[]> {
  return prisma.role.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createRole(
  name: string,
  customId: string,
  description: string,
  permissionBitmask: number,
): Promise<Role> {
  return prisma.role.create({
    data: {
      name,
      customId,
      description,
      permissionBitmask,
    },
  });
}

export async function updateRole(
  id: string,
  name: string,
  customId: string,
  description: string,
  permissionBitmask: number,
): Promise<Role | null> {
  try {
    return await prisma.role.update({
      where: { id },
      data: {
        name,
        customId,
        description,
        permissionBitmask,
      },
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return null;
    }
    throw error;
  }
}

export async function deleteRole(id: string): Promise<boolean> {
  try {
    await prisma.role.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return false;
    }
    throw error;
  }
}
