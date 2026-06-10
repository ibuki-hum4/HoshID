import type { Jwk } from "better-auth/plugins/jwt";
import auditLog from "@/lib/audit";

type JwkEnvValue = {
  id: string;
  publicKey: string;
  privateKey: string;
  createdAt?: string;
  expiresAt?: string;
  alg?: Jwk["alg"];
  crv?: Jwk["crv"];
};

type JsonWebKeySet = {
  keys: Array<JsonWebKey & { kid: string }>;
};

function parseJwkEnvValue(value: string): Jwk {
  let parsed: JwkEnvValue;
  try {
    parsed = JSON.parse(value) as JwkEnvValue;
  } catch (e) {
    console.error(
      "Failed to parse JWK env value (truncated):",
      String(value).slice(0, 200),
    );
    auditLog("jwks.parse_error", {
      truncatedValue: String(value).slice(0, 200),
    });
    throw e;
  }

  if (!parsed.id || !parsed.publicKey || !parsed.privateKey) {
    throw new Error("Invalid JWK environment payload");
  }

  return {
    id: parsed.id,
    publicKey: parsed.publicKey,
    privateKey: parsed.privateKey,
    createdAt: parsed.createdAt ? new Date(parsed.createdAt) : new Date(),
    ...(parsed.expiresAt ? { expiresAt: new Date(parsed.expiresAt) } : {}),
    ...(parsed.alg ? { alg: parsed.alg } : {}),
    ...(parsed.crv ? { crv: parsed.crv } : {}),
  };
}

export function loadRotationKeysFromEnv(): Jwk[] {
  const bulk = process.env.OIDC_JWKS_JSON;

  if (bulk) {
    try {
      const parsed = JSON.parse(bulk) as JwkEnvValue[];
      const keys: Jwk[] = [];
      for (const entry of parsed) {
        try {
          keys.push(parseJwkEnvValue(JSON.stringify(entry)));
        } catch (_err) {
          console.error(
            "Skipping malformed JWK entry in OIDC_JWKS_JSON (truncated):",
            String(JSON.stringify(entry)).slice(0, 200),
          );
          auditLog("jwks.skip_malformed_entry", {
            source: "OIDC_JWKS_JSON",
            entry: String(JSON.stringify(entry)).slice(0, 200),
          });
        }
      }
      return keys.sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
    } catch (_e) {
      console.error(
        "Failed to parse OIDC_JWKS_JSON as JSON; falling back to individual env vars. Value (truncated):",
        String(bulk).slice(0, 500),
      );
      auditLog("jwks.parse_failure", {
        source: "OIDC_JWKS_JSON",
        value: String(bulk).slice(0, 500),
      });
      // fall through to try current/previous
    }
  }

  const keys: Jwk[] = [];
  const current = process.env.OIDC_JWK_CURRENT;
  const previous = process.env.OIDC_JWK_PREVIOUS;

  if (current) {
    try {
      keys.push(parseJwkEnvValue(current));
    } catch (_e) {
      console.error(
        "Skipping malformed OIDC_JWK_CURRENT (truncated):",
        String(current).slice(0, 500),
      );
      auditLog("jwks.skip_malformed_entry", {
        source: "OIDC_JWK_CURRENT",
        value: String(current).slice(0, 500),
      });
    }
  }

  if (previous) {
    try {
      keys.push(parseJwkEnvValue(previous));
    } catch (_e) {
      console.error(
        "Skipping malformed OIDC_JWK_PREVIOUS (truncated):",
        String(previous).slice(0, 500),
      );
      auditLog("jwks.skip_malformed_entry", {
        source: "OIDC_JWK_PREVIOUS",
        value: String(previous).slice(0, 500),
      });
    }
  }

  return keys.sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );
}

export function toPublicJwks(keys: readonly Jwk[]): JsonWebKeySet {
  return {
    keys: keys.map((key) => {
      try {
        return {
          ...JSON.parse(key.publicKey),
          kid: key.id,
        };
      } catch (_e) {
        console.warn(
          "Failed to parse publicKey as JSON for JWKS entry, falling back to minimal record",
          key.id,
        );
        return {
          kid: key.id,
          alg: key.alg ?? "RS256",
          use: "sig",
        } as unknown as JsonWebKey & { kid: string };
      }
    }),
  };
}

export function hasJwksEnvConfig(): boolean {
  return Boolean(
    process.env.OIDC_JWKS_JSON ||
      process.env.OIDC_JWK_CURRENT ||
      process.env.OIDC_JWK_PREVIOUS,
  );
}

export function toOAuthProviderJwks(keys: readonly Jwk[]) {
  return keys.map((key) => ({
    id: key.id,
    publicKey: key.publicKey,
    privateKey: key.privateKey,
    createdAt: key.createdAt,
    ...(key.expiresAt ? { expiresAt: key.expiresAt } : {}),
    ...(key.alg ? { alg: key.alg } : {}),
    ...(key.crv ? { crv: key.crv } : {}),
  }));
}
