import { oauthProvider } from "@better-auth/oauth-provider";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, jwt } from "better-auth/plugins";

import { ACCOUNT_STATUS } from "@/lib/account-status";
import { ac, roles } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * `@node-rs/argon2` は Algorithm を ambient const enum として宣言しており、
 * `isolatedModules` 下では import できない。Argon2id の数値が 2。
 */
const ARGON2ID = 2;

/**
 * OWASP の推奨値。`@node-rs/argon2` の既定値と一致しているが、後から既定値が
 * 変わってもハッシュが静かに弱くならないよう明示している。
 */
const ARGON2_OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export const auth = betterAuth({
  // Discovery が返す `issuer` と ID トークンの `iss` はこの値から決まる。
  // RP 側の設定と1文字でも違うと繋がらない。
  baseURL: requireEnv("BETTER_AUTH_URL"),
  secret: requireEnv("BETTER_AUTH_SECRET"),

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    // 既定は scrypt。Argon2id に差し替える。
    password: {
      hash: (password) => argon2Hash(password, ARGON2_OPTIONS),
      verify: ({ hash, password }) => argon2Verify(hash, password),
    },
  },

  user: {
    additionalFields: {
      /**
       * `input: false` が肝。これが無いと申請 API に `status: "approved"` を
       * 混ぜるだけで承認を自称できる。下の create フックと二重の防御。
       */
      status: {
        type: "string",
        defaultValue: ACCOUNT_STATUS.pending,
        input: false,
      },
      /** 申請理由。本人が書くのでこれだけは入力を許す。 */
      applicationReason: { type: "string", required: false },
      appliedAt: { type: "date", required: false, input: false },
      reviewedAt: { type: "date", required: false, input: false },
      reviewedBy: { type: "string", required: false, input: false },
      reviewNote: { type: "string", required: false, input: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // クライアントが何を送ってきてもサーバ側で pending に固定する。
          return {
            data: {
              ...user,
              status: ACCOUNT_STATUS.pending,
              appliedAt: new Date(),
              reviewedAt: null,
              reviewedBy: null,
              reviewNote: null,
            },
          };
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          // 未承認ユーザーの遮断はここが本丸。ログイン画面を塞ぐだけでは
          // RP 経由で /oauth2/authorize に直接入られた時に素通りする。
          // セッションが作れなければ認可フローも UserInfo も通らない。
          const account = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { status: true },
          });

          if (account?.status !== ACCOUNT_STATUS.approved) {
            return false;
          }
        },
      },
    },
  },

  // jwt() が生やす /token は OAuth の /oauth2/token と紛らわしいので塞ぐ。
  disabledPaths: ["/token"],

  plugins: [
    jwt({ jwks: { keyPairConfig: { alg: "EdDSA", crv: "Ed25519" } } }),

    admin({ ac, roles, defaultRole: "user", adminRoles: ["admin"] }),

    oauthProvider({
      loginPage: "/sign-in",
      consentPage: "/consent",
      requirePKCE: true,
      accessTokenExpiresIn: 60 * 60, // 1h
      refreshTokenExpiresIn: 60 * 60 * 24 * 30, // 30d
      storeClientSecret: "hashed",
    }),

    // Server Action から Set-Cookie を返すために必要。必ず最後に置く。
    nextCookies(),
  ],
});
