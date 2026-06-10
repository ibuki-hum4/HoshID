import type { OAuthOptions, Scope } from "@better-auth/oauth-provider";

import { OIDC_ALLOWED_SCOPES, OIDC_AUDIENCE, OIDC_CONSENT_PAGE, OIDC_DEFAULT_SCOPE, OIDC_LOGIN_PAGE } from "../config";
import type { TrustedClient } from "../security/consent";
import { buildUserInfoClaims } from "../security/scopes";

export type OidcRuntimeConfig = {
  trustedClients: TrustedClient[];
};

export function createOidcOptions(runtime: OidcRuntimeConfig): OAuthOptions<Scope[]> {
  return {
    loginPage: OIDC_LOGIN_PAGE,
    consentPage: OIDC_CONSENT_PAGE,
    // Default scopes used when clients are registered without an explicit scope
    clientRegistrationDefaultScopes: [OIDC_DEFAULT_SCOPE],
    scopes: [...OIDC_ALLOWED_SCOPES],
    // Keep JWT plugin enabled (the oauth-provider option is `disableJwtPlugin`)
    disableJwtPlugin: false,
    // Advertise only what should be exposed at /.well-known/openid-configuration
    advertisedMetadata: {
      scopes_supported: [...OIDC_ALLOWED_SCOPES],
    },
    // Valid audiences for issued tokens
    validAudiences: [OIDC_AUDIENCE],
    cachedTrustedClients: new Set(runtime.trustedClients.map((client) => client.clientId)),
    customUserInfoClaims: async (info) => {
      return buildUserInfoClaims(info.user, info.scopes as unknown as string[]);
    },
  };
}
