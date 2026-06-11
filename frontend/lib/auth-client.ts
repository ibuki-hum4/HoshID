"use client";

import { jwtClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// NEXT_PUBLIC_* env vars are inlined into the browser bundle at build time,
// but the build doesn't know the deployment's public URL. Default to a
// relative path so requests resolve against the current origin instead of
// a stale `localhost:3000` baked in at build time.
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

export const authClient = createAuthClient({
  baseURL: `${appUrl}/api/auth`,
  plugins: [jwtClient()],
});

export type AuthClient = typeof authClient;
