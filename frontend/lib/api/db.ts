import "server-only";

import type {
  Announcement,
  MemberRequest,
  OAuthClient,
  Role,
  User,
} from "@prisma/client";

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
  data: Partial<
    Pick<
      MemberRequest,
      | "status"
      | "decidedAt"
      | "decidedById"
      | "userId"
      | "applicantEmail"
      | "applicantName"
    >
  >,
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

export async function getRoleById(id: string): Promise<Role | null> {
  return prisma.role.findUnique({ where: { id } });
}

export async function getRoleByCustomId(
  customId: string,
): Promise<Role | null> {
  return prisma.role.findUnique({ where: { customId } });
}

export async function countUsersWithRole(customId: string): Promise<number> {
  return prisma.user.count({ where: { role: customId } });
}

/**
 * Counts active users whose assigned role grants `bit`, optionally
 * excluding one user or one role from the calculation. Used to stop an
 * admin action from leaving the workspace with nobody able to manage
 * roles or recover from a mistake.
 */
export async function countActiveUsersWithPermission(
  bit: number,
  options: { excludeUserId?: string; excludeRoleCustomId?: string } = {},
): Promise<number> {
  const roles = await prisma.role.findMany({
    select: { customId: true, permissionBitmask: true },
  });
  const grantingCustomIds = roles
    .filter(
      (role) =>
        (role.permissionBitmask & bit) === bit &&
        role.customId !== options.excludeRoleCustomId,
    )
    .map((role) => role.customId);

  if (grantingCustomIds.length === 0) {
    return 0;
  }

  return prisma.user.count({
    where: {
      role: { in: grantingCustomIds },
      status: "active",
      ...(options.excludeUserId ? { id: { not: options.excludeUserId } } : {}),
    },
  });
}

export async function listOAuthClients(): Promise<OAuthClient[]> {
  return prisma.oAuthClient.findMany({
    orderBy: { clientIdIssuedAt: "desc" },
  });
}

export async function getOAuthClientByClientId(
  clientId: string,
): Promise<OAuthClient | null> {
  return prisma.oAuthClient.findUnique({ where: { clientId } });
}

export type OAuthClientWriteInput = {
  clientName: string;
  clientUri?: string | null;
  logoUri?: string | null;
  redirectUris: string[];
  postLogoutRedirectUris?: string[];
  contacts?: string[];
  tosUri?: string | null;
  policyUri?: string | null;
  scope?: string | null;
  tokenEndpointAuthMethod?: string | null;
  grantTypes?: string[];
  responseTypes?: string[];
  type?: string | null;
  skipConsent?: boolean | null;
  enableEndSession?: boolean | null;
  requirePkce?: boolean | null;
  disabled?: boolean;
  public?: boolean;
};

export async function createOAuthClientRecord(
  clientId: string,
  hashedSecret: string | null,
  data: OAuthClientWriteInput,
): Promise<OAuthClient> {
  return prisma.oAuthClient.create({
    data: {
      clientId,
      clientSecret: hashedSecret,
      clientSecretExpiresAt: hashedSecret ? 0 : null,
      clientIdIssuedAt: Math.floor(Date.now() / 1000),
      public: data.public ?? false,
      disabled: data.disabled ?? false,
      clientName: data.clientName,
      clientUri: data.clientUri ?? null,
      logoUri: data.logoUri ?? null,
      redirectUris: data.redirectUris,
      postLogoutRedirectUris: data.postLogoutRedirectUris ?? [],
      contacts: data.contacts ?? [],
      tosUri: data.tosUri ?? null,
      policyUri: data.policyUri ?? null,
      scope: data.scope ?? null,
      tokenEndpointAuthMethod:
        data.tokenEndpointAuthMethod ?? "client_secret_basic",
      grantTypes: data.grantTypes ?? ["authorization_code", "refresh_token"],
      responseTypes: data.responseTypes ?? ["code"],
      type: data.type ?? "web",
      skipConsent: data.skipConsent ?? false,
      enableEndSession: data.enableEndSession ?? false,
      requirePkce: data.requirePkce ?? true,
    },
  });
}

export async function updateOAuthClientRecord(
  clientId: string,
  data: Partial<OAuthClientWriteInput>,
): Promise<OAuthClient | null> {
  try {
    return await prisma.oAuthClient.update({
      where: { clientId },
      data: {
        ...(data.clientName !== undefined
          ? { clientName: data.clientName }
          : {}),
        ...(data.clientUri !== undefined ? { clientUri: data.clientUri } : {}),
        ...(data.logoUri !== undefined ? { logoUri: data.logoUri } : {}),
        ...(data.redirectUris !== undefined
          ? { redirectUris: data.redirectUris }
          : {}),
        ...(data.postLogoutRedirectUris !== undefined
          ? { postLogoutRedirectUris: data.postLogoutRedirectUris }
          : {}),
        ...(data.contacts !== undefined ? { contacts: data.contacts } : {}),
        ...(data.tosUri !== undefined ? { tosUri: data.tosUri } : {}),
        ...(data.policyUri !== undefined ? { policyUri: data.policyUri } : {}),
        ...(data.scope !== undefined ? { scope: data.scope } : {}),
        ...(data.tokenEndpointAuthMethod !== undefined
          ? { tokenEndpointAuthMethod: data.tokenEndpointAuthMethod }
          : {}),
        ...(data.grantTypes !== undefined
          ? { grantTypes: data.grantTypes }
          : {}),
        ...(data.responseTypes !== undefined
          ? { responseTypes: data.responseTypes }
          : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.skipConsent !== undefined
          ? { skipConsent: data.skipConsent }
          : {}),
        ...(data.enableEndSession !== undefined
          ? { enableEndSession: data.enableEndSession }
          : {}),
        ...(data.requirePkce !== undefined
          ? { requirePkce: data.requirePkce }
          : {}),
        ...(data.disabled !== undefined ? { disabled: data.disabled } : {}),
      },
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return null;
    }
    throw error;
  }
}

export async function updateOAuthClientSecret(
  clientId: string,
  hashedSecret: string,
): Promise<OAuthClient | null> {
  try {
    return await prisma.oAuthClient.update({
      where: { clientId },
      data: { clientSecret: hashedSecret, clientSecretExpiresAt: 0 },
    });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return null;
    }
    throw error;
  }
}

export async function deleteOAuthClientRecord(
  clientId: string,
): Promise<boolean> {
  try {
    await prisma.oAuthClient.delete({ where: { clientId } });
    return true;
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return false;
    }
    throw error;
  }
}
