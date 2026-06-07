import "server-only";

import type { Announcement, MemberRequest, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function listApiUsers(): Promise<User[]> {
  return prisma.user.findMany({
    orderBy: { id: "asc" },
  });
}

export async function getApiUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id },
  });
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
): Promise<MemberRequest> {
  return prisma.memberRequest.create({
    data: {
      applicantEmail,
      applicantName: applicantName || null,
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
  } catch {
    return null;
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
  } catch {
    return null;
  }
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  try {
    await prisma.announcement.delete({
      where: { id },
    });
    return true;
  } catch {
    return false;
  }
}
