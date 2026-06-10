import { NextResponse } from "next/server";

import { enforceRateLimit, getClientIp } from "@/lib/api/rate-limit";
import auditLog from "@/lib/audit";
import { auth } from "@/lib/auth";

type BootstrapRequest = {
  redirectUris?: string[];
  clientName?: string;
  clientUri?: string;
  logoUri?: string;
  contacts?: string[];
  tosUri?: string;
  policyUri?: string;
  postLogoutRedirectUris?: string[];
  tokenEndpointAuthMethod?:
    | "none"
    | "client_secret_basic"
    | "client_secret_post";
  grantTypes?: Array<
    "authorization_code" | "client_credentials" | "refresh_token"
  >;
  responseTypes?: Array<"code">;
  type?: "web" | "native" | "user-agent-based";
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimited = await enforceRateLimit(
    `oauth-bootstrap:ip:${ip}`,
    10,
    60,
  );
  if (rateLimited) {
    return rateLimited;
  }

  const expectedToken = process.env.OIDC_ADMIN_BOOTSTRAP_TOKEN;
  const bootstrapToken = request.headers.get("x-admin-bootstrap-token");

  if (!expectedToken || bootstrapToken !== expectedToken) {
    auditLog("admin.bootstrap.unauthorized", {
      remote: request.headers.get("x-forwarded-for"),
      tokenPresent: !!bootstrapToken,
    });
    return jsonError("Unauthorized", 401);
  }

  const body = (await request.json()) as BootstrapRequest;
  const redirectUris = body.redirectUris ?? [];

  if (redirectUris.length === 0) {
    return jsonError("redirectUris is required", 400);
  }

  const clientId = process.env.OIDC_GO_CLIENT_ID;

  if (!clientId) {
    return jsonError("OIDC_GO_CLIENT_ID is required", 400);
  }

  const headerObj = Object.fromEntries(request.headers) as Record<
    string,
    string
  >;

  try {
    const existing = await auth.api
      .getOAuthClient({
        query: { client_id: clientId },
        headers: headerObj,
      })
      .catch(() => null);

    if (existing) {
      auditLog("admin.bootstrap.found", {
        clientId,
        existing: { id: existing.id, client_id: existing.client_id },
      });
      return NextResponse.json(existing);
    }

    const created = await auth.api.createOAuthClient({
      body: {
        redirect_uris: redirectUris,
        client_name: body.clientName ?? "Go API",
        client_uri: body.clientUri,
        logo_uri: body.logoUri,
        contacts: body.contacts,
        tos_uri: body.tosUri,
        policy_uri: body.policyUri,
        post_logout_redirect_uris: body.postLogoutRedirectUris,
        token_endpoint_auth_method:
          body.tokenEndpointAuthMethod ?? "client_secret_basic",
        grant_types: body.grantTypes ?? ["authorization_code", "refresh_token"],
        response_types: body.responseTypes ?? ["code"],
        type: body.type ?? "web",
      },
      headers: headerObj,
    });

    auditLog("admin.bootstrap.created", {
      clientId,
      created: { id: created.id, client_id: created.client_id },
    });

    return NextResponse.json(created);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    auditLog("admin.bootstrap.error", {
      clientId,
      error: errorMessage,
      stack: errorStack,
    });
    return jsonError("Failed to provision OAuth client", 500);
  }
}
