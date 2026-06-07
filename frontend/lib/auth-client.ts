"use client";

import { createAuthClient } from "better-auth/react";
import { jwtClient } from "better-auth/client/plugins";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: `${appUrl}/api/auth`,
  plugins: [jwtClient()],
});

export type AuthClient = typeof authClient;