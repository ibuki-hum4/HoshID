import type { OidcScope } from "../config";

export type TrustedClient = {
  clientId: string;
  redirectUrls: string[];
  skipConsent?: boolean;
  clientSecret?: string;
  metadata?: Record<string, unknown>;
};

export type ConsentDecision = {
  requireConsent: boolean;
  reason?: string;
};

export function isTrustedClient(clientId: string, trustedClients: readonly TrustedClient[]): boolean {
  return trustedClients.some((client) => client.clientId === clientId);
}

export function shouldSkipConsent(input: {
  clientId: string;
  scopes: readonly OidcScope[];
  prompt?: string;
  trustedClients: readonly TrustedClient[];
}): ConsentDecision {
  const client = input.trustedClients.find((candidate) => candidate.clientId === input.clientId);

  if (!client) {
    return { requireConsent: true, reason: "client_not_trusted" };
  }

  if (client.skipConsent && input.prompt !== "consent") {
    return { requireConsent: false, reason: "trusted_first_party" };
  }

  return { requireConsent: true, reason: "explicit_consent_required" };
}
