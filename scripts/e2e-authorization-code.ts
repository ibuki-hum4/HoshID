/// <reference types="bun" />
/**
 * Authorization Code + PKCE を頭から終わりまで通す自動検証。
 *
 *   HOSHID_CLIENT_ID=... HOSHID_CLIENT_SECRET=... \
 *   E2E_EMAIL=... E2E_PASSWORD=... \
 *   bun run scripts/e2e-authorization-code.ts
 *
 * RP 側は openid-client に任せる。nonce・state・PKCE・iss の一致・ID トークンの
 * 署名検証をライブラリが仕様どおりに行うため、ここが通れば実装は概ね仕様準拠。
 * IdP 側の画面操作（ログイン・同意）はブラウザの代わりに API を直接叩く。
 */
import * as client from "openid-client";

import { prisma } from "@/lib/prisma";

const ISSUER = process.env.HOSHID_ISSUER ?? "http://localhost:3000/api/auth";
const REDIRECT_URI = process.env.E2E_REDIRECT_URI ?? "http://127.0.0.1:4000/callback";
const SCOPE = "openid profile email offline_access";
/** CSRF 保護のために送る Origin。 */
const ORIGIN = new URL(ISSUER).origin;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}`);
  if (!ok) {
    failures += 1;
    if (detail !== undefined) console.log("        ", detail);
  }
}

/** 最小の Cookie ジャー。 */
const jar = new Map<string, string>();

function cookieHeader(): string {
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

function absorbCookies(response: Response) {
  for (const entry of response.headers.getSetCookie()) {
    const [pair] = entry.split(";");
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
}

async function main() {
  const config = await client.discovery(
    new URL(ISSUER),
    requireEnv("HOSHID_CLIENT_ID"),
    requireEnv("HOSHID_CLIENT_SECRET"),
    // クライアントは client_secret_basic で登録されている。openid-client の
    // 既定は client_secret_post なので明示しないと invalid_client になる。
    client.ClientSecretBasic(requireEnv("HOSHID_CLIENT_SECRET")),
    ISSUER.startsWith("http://") ? { execute: [client.allowInsecureRequests] } : undefined,
  );
  check("discovery が成功し issuer が一致する", true);

  // --- RP: 認可リクエストを組み立てる ---
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();

  const authorizationUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });

  // --- IdP: ログイン ---
  const signIn = await fetch(`${ISSUER}/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify({
      email: requireEnv("E2E_EMAIL"),
      password: requireEnv("E2E_PASSWORD"),
    }),
  });
  absorbCookies(signIn);
  check("承認済みユーザーでログインできる", signIn.ok && jar.size > 0, signIn.status);

  // 一度同意すると記録されて次回から同意画面が出ない。同意画面の経路を
  // 確実に通すため、この組み合わせの同意を消してから始める。
  await prisma.oauthConsent.deleteMany({});

  /** 認可エンドポイントを叩いて Location を返す。 */
  async function authorizeOnce(url: URL): Promise<string> {
    const response = await fetch(url, {
      headers: { cookie: cookieHeader() },
      redirect: "manual",
    });
    absorbCookies(response);
    const location = response.headers.get("location");
    if (!location) throw new Error(`authorize did not redirect: ${response.status}`);
    return location;
  }

  // --- IdP: 認可エンドポイント（未同意なので同意画面へ） ---
  const consentLocation = await authorizeOnce(authorizationUrl);
  check("未同意なら同意画面へ誘導される", consentLocation.includes("/consent"), consentLocation);

  // 同意画面が受け取る署名付きクエリ。画面はこれを変えずに返す。
  const consentQuery = new URL(consentLocation, ISSUER).searchParams;
  check("同意画面に署名付きクエリが渡る", consentQuery.has("sig"));

  // --- IdP: 同意 ---
  const consent = await fetch(`${ISSUER}/oauth2/consent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      // Better Auth の CSRF 保護は Origin を要求する。ブラウザなら自動で付く。
      origin: ORIGIN,
      cookie: cookieHeader(),
    },
    body: JSON.stringify({
      accept: true,
      scope: SCOPE,
      oauth_query: consentQuery.toString(),
    }),
  });
  absorbCookies(consent);

  const consentResult = (await consent.json()) as { redirect?: boolean; url?: string };
  check("同意すると redirect_uri へ戻される", Boolean(consentResult.url), consentResult);
  if (!consentResult.url) throw new Error("consent did not return a redirect url");

  const callbackUrl = new URL(consentResult.url);
  check("認可コードが付与される", callbackUrl.searchParams.has("code"));
  check("state が往復する", callbackUrl.searchParams.get("state") === state);
  check(
    "iss が返される (RFC 9207)",
    callbackUrl.searchParams.get("iss") === config.serverMetadata().issuer,
    callbackUrl.searchParams.get("iss"),
  );

  // --- RP: トークン交換（署名・iss・aud・exp・nonce をライブラリが検証） ---
  const tokens = await client.authorizationCodeGrant(config, callbackUrl, {
    pkceCodeVerifier: codeVerifier,
    expectedState: state,
    expectedNonce: nonce,
  });
  const claims = tokens.claims();

  check("ID トークンが検証を通る", Boolean(claims?.sub), claims);
  check("iss が issuer と一致する", claims?.iss === config.serverMetadata().issuer);
  check("aud がクライアントと一致する", String(claims?.aud) === requireEnv("HOSHID_CLIENT_ID"));
  check("nonce が往復する", claims?.nonce === nonce);

  // --- UserInfo ---
  const userInfo = await client.fetchUserInfo(config, tokens.access_token, claims!.sub);
  check("UserInfo が sub を返す", userInfo.sub === claims!.sub);
  check("UserInfo が email を返す", typeof userInfo.email === "string", userInfo);

  // --- リフレッシュ ---
  if (tokens.refresh_token) {
    const refreshed = await client.refreshTokenGrant(config, tokens.refresh_token);
    check("refresh_token で更新できる", Boolean(refreshed.access_token));
  } else {
    check("refresh_token が発行される", false, "offline_access が要るかもしれない");
  }

  // --- 認可コードの再利用は拒否されること ---
  let reuseRejected = false;
  try {
    await client.authorizationCodeGrant(config, callbackUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
      expectedNonce: nonce,
    });
  } catch {
    reuseRejected = true;
  }
  check("認可コードの再利用は拒否される", reuseRejected);

  // --- 一度同意したら次回は同意画面を挟まないこと ---
  const secondVerifier = client.randomPKCECodeVerifier();
  const secondLocation = await authorizeOnce(
    client.buildAuthorizationUrl(config, {
      redirect_uri: REDIRECT_URI,
      scope: SCOPE,
      code_challenge: await client.calculatePKCECodeChallenge(secondVerifier),
      code_challenge_method: "S256",
      state: client.randomState(),
      nonce: client.randomNonce(),
    }),
  );
  check(
    "同意済みなら同意画面を挟まずコードが返る",
    secondLocation.startsWith(REDIRECT_URI) && secondLocation.includes("code="),
    secondLocation,
  );

  await prisma.$disconnect();

  console.log(`\n${failures === 0 ? "すべて PASS" : `${failures} 件 FAIL`}\n`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
