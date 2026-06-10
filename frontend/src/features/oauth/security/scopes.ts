import { OIDC_ALLOWED_SCOPES, type OidcScope } from "../config";

export function normalizeRequestedScopes(
  scopes: readonly string[] | undefined,
): OidcScope[] {
  if (!scopes || scopes.length === 0) {
    return ["openid"];
  }

  const unique = [
    ...new Set(scopes.map((scope) => scope.trim()).filter(Boolean)),
  ];
  return unique.map((scope) => assertAllowedScope(scope));
}

export function assertAllowedScope(scope: string): OidcScope {
  if (!OIDC_ALLOWED_SCOPES.includes(scope as OidcScope)) {
    throw new Error(`Unsupported scope: ${scope}`);
  }

  return scope as OidcScope;
}

export function assertAllowedScopes(scopes: readonly string[]): OidcScope[] {
  const normalized = normalizeRequestedScopes(scopes);

  if (!normalized.includes("openid")) {
    throw new Error("openid scope is required");
  }

  return normalized;
}

export function hasScope(scopes: readonly string[], scope: OidcScope): boolean {
  return scopes.includes(scope);
}

export function buildUserInfoClaims(
  user: {
    id: string;
    email: string;
    emailVerified?: boolean | null;
    name?: string | null;
    image?: string | null;
    [key: string]: unknown;
  },
  scopes: readonly string[],
) {
  const claims: Record<string, unknown> = {
    sub: user.id,
  };

  if (hasScope(scopes, "profile")) {
    if (user.name) {
      claims.name = user.name;
    }
    if (user.image) {
      claims.picture = user.image;
    }
  }

  if (hasScope(scopes, "email")) {
    claims.email = user.email;
    claims.email_verified = Boolean(user.emailVerified);
  }

  return claims;
}
