import { z } from "zod";

import { getUserFromRequest, requirePermission } from "@/lib/api/auth";
import { createOAuthClientRecord, listOAuthClients } from "@/lib/api/db";
import {
  generateClientId,
  generateClientSecret,
  hashClientSecret,
  toPublicOAuthClient,
} from "@/lib/api/oauth-clients";
import { isPrismaErrorCode } from "@/lib/api/prisma-errors";
import {
  jsonError,
  jsonForbidden,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/api/responses";
import { OIDC_ALLOWED_SCOPES } from "@/src/features/oauth/config";
import { PERMISSIONS } from "@/src/features/rbac/permissions";

export const runtime = "nodejs";

const urlField = z.string().trim().url().max(2000);

const createClientSchema = z
  .object({
    clientName: z.string().trim().min(1).max(200),
    clientUri: urlField.optional().or(z.literal("")),
    logoUri: urlField.optional().or(z.literal("")),
    tosUri: urlField.optional().or(z.literal("")),
    policyUri: urlField.optional().or(z.literal("")),
    redirectUris: z.array(urlField).max(20).default([]),
    postLogoutRedirectUris: z.array(urlField).max(20).default([]),
    contacts: z.array(z.string().trim().email()).max(10).default([]),
    scopes: z.array(z.enum(OIDC_ALLOWED_SCOPES)).min(1).default(["openid"]),
    tokenEndpointAuthMethod: z
      .enum(["none", "client_secret_basic", "client_secret_post"])
      .default("client_secret_basic"),
    grantTypes: z
      .array(
        z.enum(["authorization_code", "client_credentials", "refresh_token"]),
      )
      .min(1)
      .default(["authorization_code", "refresh_token"]),
    type: z.enum(["web", "native", "user-agent-based"]).optional(),
    skipConsent: z.boolean().default(false),
    enableEndSession: z.boolean().default(false),
    disabled: z.boolean().default(false),
  })
  .refine(
    (data) =>
      !data.grantTypes.includes("authorization_code") ||
      data.redirectUris.length > 0,
    {
      message:
        "redirectUris is required when grantTypes includes authorization_code",
      path: ["redirectUris"],
    },
  );

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const error = await requirePermission(user, PERMISSIONS.MANAGE_APPLICATIONS);
  if (error) {
    return jsonForbidden(error);
  }

  const clients = await listOAuthClients();
  return jsonOk({ clients: clients.map(toPublicOAuthClient) });
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const error = await requirePermission(user, PERMISSIONS.MANAGE_APPLICATIONS);
  if (error) {
    return jsonForbidden(error);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (_err) {
    return jsonError("invalid json", 400);
  }

  const parsed = createClientSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "invalid payload", 400);
  }

  const data = parsed.data;
  const isPublic = data.tokenEndpointAuthMethod === "none";
  const resolvedType = data.type ?? (isPublic ? "native" : "web");

  if (isPublic && resolvedType === "web") {
    return jsonError(
      "type must be 'native' or 'user-agent-based' for public clients",
      400,
    );
  }
  if (!isPublic && resolvedType !== "web") {
    return jsonError("type must be 'web' for confidential clients", 400);
  }

  const clientId = generateClientId();
  const clientSecret = isPublic ? null : generateClientSecret();
  const hashedSecret = clientSecret
    ? await hashClientSecret(clientSecret)
    : null;

  try {
    const created = await createOAuthClientRecord(clientId, hashedSecret, {
      clientName: data.clientName,
      clientUri: data.clientUri || null,
      logoUri: data.logoUri || null,
      tosUri: data.tosUri || null,
      policyUri: data.policyUri || null,
      redirectUris: data.redirectUris,
      postLogoutRedirectUris: data.postLogoutRedirectUris,
      contacts: data.contacts,
      scope: data.scopes.join(" "),
      tokenEndpointAuthMethod: data.tokenEndpointAuthMethod,
      grantTypes: data.grantTypes,
      responseTypes: ["code"],
      type: resolvedType,
      skipConsent: data.skipConsent,
      enableEndSession: data.enableEndSession,
      requirePkce: true,
      disabled: data.disabled,
      public: isPublic,
    });

    return jsonOk({ client: toPublicOAuthClient(created), clientSecret }, 201);
  } catch (caught) {
    if (isPrismaErrorCode(caught, "P2002")) {
      return jsonError("client id collision, please retry", 409);
    }
    throw caught;
  }
}
