import type { NextRequest } from "next/server";
import { z } from "zod";

import { getUserFromRequest, requirePermission } from "@/lib/api/auth";
import {
  deleteOAuthClientRecord,
  getOAuthClientByClientId,
  updateOAuthClientRecord,
} from "@/lib/api/db";
import { toPublicOAuthClient } from "@/lib/api/oauth-clients";
import {
  jsonError,
  jsonForbidden,
  jsonNotFound,
  jsonOk,
  jsonUnauthorized,
} from "@/lib/api/responses";
import { OIDC_ALLOWED_SCOPES } from "@/src/features/oauth/config";
import { PERMISSIONS } from "@/src/features/rbac/permissions";

export const runtime = "nodejs";

const urlField = z.string().trim().url().max(2000);

const updateClientSchema = z.object({
  clientName: z.string().trim().min(1).max(200).optional(),
  clientUri: urlField.optional().or(z.literal("")),
  logoUri: urlField.optional().or(z.literal("")),
  tosUri: urlField.optional().or(z.literal("")),
  policyUri: urlField.optional().or(z.literal("")),
  redirectUris: z.array(urlField).max(20).optional(),
  postLogoutRedirectUris: z.array(urlField).max(20).optional(),
  contacts: z.array(z.string().trim().email()).max(10).optional(),
  scopes: z.array(z.enum(OIDC_ALLOWED_SCOPES)).min(1).optional(),
  grantTypes: z
    .array(
      z.enum(["authorization_code", "client_credentials", "refresh_token"]),
    )
    .min(1)
    .optional(),
  skipConsent: z.boolean().optional(),
  enableEndSession: z.boolean().optional(),
  disabled: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const error = await requirePermission(user, PERMISSIONS.MANAGE_APPLICATIONS);
  if (error) {
    return jsonForbidden(error);
  }

  const params = await context.params;
  const client = await getOAuthClientByClientId(params.id);
  if (!client) {
    return jsonNotFound("client not found");
  }

  return jsonOk({ client: toPublicOAuthClient(client) });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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

  const parsed = updateClientSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "invalid payload", 400);
  }

  const params = await context.params;
  const existing = await getOAuthClientByClientId(params.id);
  if (!existing) {
    return jsonNotFound("client not found");
  }

  const data = parsed.data;
  const nextGrantTypes = data.grantTypes ?? existing.grantTypes;
  const nextRedirectUris = data.redirectUris ?? existing.redirectUris;
  if (
    nextGrantTypes.includes("authorization_code") &&
    nextRedirectUris.length === 0
  ) {
    return jsonError(
      "redirectUris is required when grantTypes includes authorization_code",
      400,
    );
  }

  const updated = await updateOAuthClientRecord(params.id, {
    ...(data.clientName !== undefined ? { clientName: data.clientName } : {}),
    ...(data.clientUri !== undefined
      ? { clientUri: data.clientUri || null }
      : {}),
    ...(data.logoUri !== undefined ? { logoUri: data.logoUri || null } : {}),
    ...(data.tosUri !== undefined ? { tosUri: data.tosUri || null } : {}),
    ...(data.policyUri !== undefined
      ? { policyUri: data.policyUri || null }
      : {}),
    ...(data.redirectUris !== undefined
      ? { redirectUris: data.redirectUris }
      : {}),
    ...(data.postLogoutRedirectUris !== undefined
      ? { postLogoutRedirectUris: data.postLogoutRedirectUris }
      : {}),
    ...(data.contacts !== undefined ? { contacts: data.contacts } : {}),
    ...(data.scopes !== undefined ? { scope: data.scopes.join(" ") } : {}),
    ...(data.grantTypes !== undefined ? { grantTypes: data.grantTypes } : {}),
    ...(data.skipConsent !== undefined
      ? { skipConsent: data.skipConsent }
      : {}),
    ...(data.enableEndSession !== undefined
      ? { enableEndSession: data.enableEndSession }
      : {}),
    ...(data.disabled !== undefined ? { disabled: data.disabled } : {}),
  });

  if (!updated) {
    return jsonNotFound("client not found");
  }

  return jsonOk({ client: toPublicOAuthClient(updated) });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return jsonUnauthorized("invalid token");
  }

  const error = await requirePermission(user, PERMISSIONS.MANAGE_APPLICATIONS);
  if (error) {
    return jsonForbidden(error);
  }

  const params = await context.params;
  const deleted = await deleteOAuthClientRecord(params.id);
  if (!deleted) {
    return jsonNotFound("client not found");
  }

  return jsonOk({ result: "deleted" });
}
