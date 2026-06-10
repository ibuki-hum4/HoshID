import { z } from "zod";

import type { TrustedClient } from "../security/consent";

const trustedClientSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1).optional(),
  redirectUrls: z.array(z.string().url()).min(1),
  skipConsent: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export function loadTrustedClientsFromEnv(): TrustedClient[] {
  const json = process.env.OIDC_TRUSTED_CLIENTS_JSON;

  if (json) {
    const parsed = z
      .array(trustedClientSchema)
      .parse(JSON.parse(json) as unknown);
    return parsed;
  }

  const clientId = process.env.OIDC_GO_CLIENT_ID;
  const redirectUrls = process.env.OIDC_GO_REDIRECT_URLS;

  if (!clientId || !redirectUrls) {
    return [];
  }

  return [
    trustedClientSchema.parse({
      clientId,
      clientSecret: process.env.OIDC_GO_CLIENT_SECRET,
      redirectUrls: redirectUrls.split(/\s*,\s*/).filter(Boolean),
      skipConsent: process.env.OIDC_GO_SKIP_CONSENT !== "false",
      metadata: {
        name: process.env.OIDC_GO_CLIENT_NAME ?? "Go API",
      },
    }),
  ];
}
