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

  // ここに /.well-known の rewrite は置かない。
  //
  // Better Auth は /api/auth にマウントされ、issuer も
  // "<origin>/api/auth" を名乗る。OIDC Discovery は issuer に
  // "/.well-known/openid-configuration" を連結した場所を見るので、
  // 現状で既に仕様どおり整合している。
  //
  // ルート直下にも同じ文書を出すと、そこで discovery した RP は issuer を
  // "<origin>" だと解釈する一方、文書は "<origin>/api/auth" を名乗るため、
  // issuer の不一致として弾かれる。RP に設定する issuer は
  // "<origin>/api/auth" で統一すること。
};

export default nextConfig;
