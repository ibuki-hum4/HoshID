export const OIDC_ALLOWED_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
] as const;

export type OidcScope = (typeof OIDC_ALLOWED_SCOPES)[number];

export const OIDC_DEFAULT_SCOPE: OidcScope = "openid";
export const OIDC_CONSENT_PAGE = "/oauth/authorize";
export const OIDC_LOGIN_PAGE = "/sign-in";
export const OIDC_JWKS_PATH = "/api/auth/jwks";

export const OIDC_ISSUER =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
export const OIDC_AUDIENCE = process.env.OIDC_AUDIENCE ?? "hoshid-go-api";
