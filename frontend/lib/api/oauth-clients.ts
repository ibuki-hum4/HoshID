import "server-only";

import type { OAuthClient } from "@prisma/client";

const CLIENT_ID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomString(length: number, alphabet: string): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

export function generateClientId(): string {
  return randomString(32, CLIENT_ID_ALPHABET);
}

export function generateClientSecret(): string {
  return randomString(48, CLIENT_ID_ALPHABET);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Matches Better Auth's default OAuth client secret hasher (SHA-256,
 * base64url, unsalted) so admin-issued clients authenticate at the real
 * `/oauth2/token` endpoint exactly like self-registered ones.
 * See @better-auth/oauth-provider's `defaultHasher`.
 */
export async function hashClientSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Strips the (hashed) client secret before sending a client record to the
 * dashboard; `hasSecret` tells the UI whether a secret exists without ever
 * exposing its value, which can only be seen once at creation/rotation time.
 */
export function toPublicOAuthClient(client: OAuthClient) {
  const { clientSecret, ...rest } = client;
  return { ...rest, hasSecret: clientSecret != null };
}
