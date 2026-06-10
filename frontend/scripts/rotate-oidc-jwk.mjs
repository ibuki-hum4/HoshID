// Automates OIDC JWK rotation for the hoshid-secrets Secret:
//   1. If OIDC_JWK_PREVIOUS exists and has not expired yet, do nothing
//      (a key still needed to verify outstanding tokens must not be
//      replaced).
//   2. Otherwise, promote OIDC_JWK_CURRENT to OIDC_JWK_PREVIOUS (stamping
//      it with an expiresAt = now + OIDC_JWK_GRACE_PERIOD_DAYS) and
//      generate a fresh OIDC_JWK_CURRENT.
//   3. Roll the frontend Deployment so new pods pick up the rotated keys.
//
// Intended to run as a Kubernetes CronJob
// (see k8s/frontend/jwk-rotation-cronjob.yaml). Requires RBAC: get/patch on
// the hoshid-secrets Secret and patch on the frontend Deployment
// (see k8s/frontend/jwk-rotation-rbac.yaml).
import { randomUUID } from "node:crypto";
import { AppsV1Api, CoreV1Api, KubeConfig } from "@kubernetes/client-node";
import { exportJWK, generateKeyPair } from "jose";

const NAMESPACE = process.env.OIDC_JWK_ROTATION_NAMESPACE || "hoshid";
const SECRET_NAME =
  process.env.OIDC_JWK_ROTATION_SECRET_NAME || "hoshid-secrets";
const DEPLOYMENT_NAME = process.env.OIDC_JWK_ROTATION_DEPLOYMENT || "frontend";
const GRACE_PERIOD_DAYS = Number(process.env.OIDC_JWK_GRACE_PERIOD_DAYS || "7");

function log(event, details = {}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "oidc-jwk-rotator",
      event,
      details,
    }),
  );
}

async function generateKey() {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
    crv: "Ed25519",
    extractable: true,
  });

  return {
    id: randomUUID(),
    publicKey: JSON.stringify(await exportJWK(publicKey)),
    privateKey: JSON.stringify(await exportJWK(privateKey)),
    alg: "EdDSA",
    crv: "Ed25519",
    createdAt: new Date().toISOString(),
  };
}

function decodeSecretValue(data, key) {
  const value = data?.[key];
  return value ? Buffer.from(value, "base64").toString("utf8") : undefined;
}

function encodeSecretValue(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

const kc = new KubeConfig();
kc.loadFromDefault();
const coreApi = kc.makeApiClient(CoreV1Api);
const appsApi = kc.makeApiClient(AppsV1Api);

const secret = await coreApi.readNamespacedSecret({
  name: SECRET_NAME,
  namespace: NAMESPACE,
});

const currentRaw = decodeSecretValue(secret.data, "OIDC_JWK_CURRENT");
if (!currentRaw) {
  throw new Error(
    `OIDC_JWK_CURRENT not found in Secret ${SECRET_NAME}/${NAMESPACE}`,
  );
}

const previousRaw = decodeSecretValue(secret.data, "OIDC_JWK_PREVIOUS");
const previous = previousRaw ? JSON.parse(previousRaw) : undefined;

if (
  previous?.expiresAt &&
  new Date(previous.expiresAt).getTime() > Date.now()
) {
  log("jwks.rotation.skipped", {
    reason: "previous key has not expired yet",
    previousId: previous.id,
    expiresAt: previous.expiresAt,
  });
  process.exit(0);
}

const current = JSON.parse(currentRaw);
const newPrevious = {
  ...current,
  expiresAt: new Date(
    Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString(),
};
const newCurrent = await generateKey();

await coreApi.patchNamespacedSecret({
  name: SECRET_NAME,
  namespace: NAMESPACE,
  body: [
    {
      op: "add",
      path: "/data/OIDC_JWK_CURRENT",
      value: encodeSecretValue(JSON.stringify(newCurrent)),
    },
    {
      op: "add",
      path: "/data/OIDC_JWK_PREVIOUS",
      value: encodeSecretValue(JSON.stringify(newPrevious)),
    },
  ],
});

log("jwks.rotation.rotated", {
  newCurrentId: newCurrent.id,
  retiredId: newPrevious.id,
  retiredExpiresAt: newPrevious.expiresAt,
});

await appsApi.patchNamespacedDeployment({
  name: DEPLOYMENT_NAME,
  namespace: NAMESPACE,
  body: [
    {
      op: "add",
      path: "/spec/template/metadata/annotations/kubectl.kubernetes.io~1restartedAt",
      value: new Date().toISOString(),
    },
  ],
});

log("jwks.rotation.rollout_restarted", { deployment: DEPLOYMENT_NAME });
