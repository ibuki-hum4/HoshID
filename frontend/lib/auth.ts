import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { jwt, username } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";

import { OIDC_AUDIENCE, OIDC_ISSUER, OIDC_JWKS_PATH } from "@/src/features/oauth/config";
import { createOidcOptions } from "@/src/features/oauth/application/oidc-policy";
import { loadRotationKeysFromEnv } from "@/src/features/oauth/security/jwks";
import { loadTrustedClientsFromEnv } from "@/src/features/oauth/infrastructure/trusted-clients";

import { prisma } from "./prisma";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const authSecret = process.env.BETTER_AUTH_SECRET ?? "replace-me-before-production";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

export const auth = betterAuth({
  baseURL: appUrl,
  secret: authSecret,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    transaction: true,
  }),
  disableSettingJwtHeader: true,
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
  },
  plugins: [
    jwt({
      jwks: {
        jwksPath: OIDC_JWKS_PATH,
        disablePrivateKeyEncryption: true,
      },
      adapter: {
        getJwks: async () => loadRotationKeysFromEnv(),
      },
      jwt: {
        issuer: OIDC_ISSUER,
        audience: OIDC_AUDIENCE,
        expirationTime: "15m",
        definePayload: ({ session, user }) => ({
          sub: user.id,
          email: user.email,
          name: user.name,
          sessionId: session.id,
        }),
      },
    }),
    username(),
    oauthProvider(
      createOidcOptions({
        trustedClients: loadTrustedClientsFromEnv(),
      }),
    ),
    nextCookies(),
  ],
  socialProviders: {
    ...(googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            scope: ["openid", "email", "profile"],
          },
        }
      : {}),
    ...(githubClientId && githubClientSecret
      ? {
          github: {
            clientId: githubClientId,
            clientSecret: githubClientSecret,
            scope: ["read:user", "user:email"],
          },
        }
      : {}),
  },
});

export type AuthInstance = typeof auth;