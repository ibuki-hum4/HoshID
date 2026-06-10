// Generates a single OIDC signing key in the JSON format expected by
// OIDC_JWK_CURRENT / OIDC_JWK_PREVIOUS (see src/features/oauth/security/jwks.ts).
//
// Usage:
//   node scripts/generate-oidc-jwk.mjs
//
// Copy the printed JSON as the value of OIDC_JWK_CURRENT (single line),
// or base64-encode it for a Kubernetes Secret:
//   node scripts/generate-oidc-jwk.mjs | tail -1 | base64 -w0
import { randomUUID } from "node:crypto";
import { exportJWK, generateKeyPair } from "jose";

const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
  crv: "Ed25519",
  extractable: true,
});

const jwk = {
  id: randomUUID(),
  publicKey: JSON.stringify(await exportJWK(publicKey)),
  privateKey: JSON.stringify(await exportJWK(privateKey)),
  alg: "EdDSA",
  crv: "Ed25519",
  createdAt: new Date().toISOString(),
};

console.log(JSON.stringify(jwk));
