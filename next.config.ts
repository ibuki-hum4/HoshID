import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Built as a self-contained server bundle so the container image for k8s does
  // not need node_modules.
  output: "standalone",

  // Prisma 7 ships a native query compiler and a generated client that must not
  // be bundled.
  serverExternalPackages: ["@prisma/client", "pg"],

  turbopack: {
    // Turbopack loses track of the generated client during SSR and fails with
    // "Cannot find module '.prisma/client/default'". Pointing the request at
    // the generated file resolves it.
    resolveAlias: {
      ".prisma/client/default": "./node_modules/.prisma/client/default.js",
    },
  },

  async rewrites() {
    // Better Auth mounts its handler under /api/auth/*, but relying parties
    // discover an OIDC provider at the issuer root. Serving the well-known
    // documents from both places lets `issuer`, the `iss` claim of issued ID
    // tokens and the issuer configured in each RP be the same origin.
    return [
      {
        source: "/.well-known/openid-configuration",
        destination: "/api/auth/.well-known/openid-configuration",
      },
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/auth/.well-known/oauth-authorization-server",
      },
      {
        source: "/.well-known/jwks.json",
        destination: "/api/auth/jwks",
      },
    ];
  },
};

export default nextConfig;
