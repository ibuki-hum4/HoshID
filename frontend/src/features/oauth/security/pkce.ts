import { createHash, timingSafeEqual } from "node:crypto";

export type CodeChallengeMethod = "plain" | "s256";

export function base64UrlEncode(input: Buffer | Uint8Array | string): string {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input);
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function deriveS256CodeChallenge(codeVerifier: string): string {
  return base64UrlEncode(createHash("sha256").update(codeVerifier, "utf8").digest());
}

export function verifyPkceChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: CodeChallengeMethod = "s256",
): boolean {
  if (method === "plain") {
    return timingSafeEqual(Buffer.from(codeVerifier), Buffer.from(codeChallenge));
  }

  const expected = deriveS256CodeChallenge(codeVerifier);
  return timingSafeEqual(Buffer.from(expected), Buffer.from(codeChallenge));
}

export function assertPkceVerifier(codeVerifier: string): void {
  if (codeVerifier.length < 43 || codeVerifier.length > 128) {
    throw new Error("PKCE code_verifier must be between 43 and 128 characters");
  }
  if (!/^[A-Za-z0-9\-._~]+$/.test(codeVerifier)) {
    throw new Error("PKCE code_verifier contains invalid characters");
  }
}
