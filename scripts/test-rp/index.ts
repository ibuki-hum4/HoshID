/**
 * HoshID を検証するための最小の Relying Party。
 *
 *   HOSHID_CLIENT_ID=... HOSHID_CLIENT_SECRET=... bun run scripts/test-rp/index.ts
 *
 * ブラウザで http://127.0.0.1:4000/login を開くと HoshID に飛ぶ。
 *
 * 検証に openid-client を使うのは、nonce・state・PKCE・iss の一致・ID トークンの
 * 署名検証をライブラリ側が仕様どおりに行うため。自前で検証すると「通ったつもり」
 * になりやすい。これが通れば実装は概ね仕様準拠と言える。
 */
/// <reference types="bun" />
import * as client from "openid-client";

const ISSUER = process.env.HOSHID_ISSUER ?? "http://localhost:3000";
const PORT = Number(process.env.PORT ?? 4000);
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPE = "openid profile email";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const config = await client.discovery(
  new URL(ISSUER),
  requireEnv("HOSHID_CLIENT_ID"),
  requireEnv("HOSHID_CLIENT_SECRET"),
  undefined,
  // 開発時は issuer が http なので明示的に許可する。本番では使わない。
  ISSUER.startsWith("http://") ? { execute: [client.allowInsecureRequests] } : undefined,
);

console.log("--- discovery ---");
console.log(JSON.stringify(config.serverMetadata(), null, 2));

/** state をキーに、認可リクエストの控えを保持する。 */
const pending = new Map<
  string,
  { codeVerifier: string; nonce: string }
>();

function html(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>HoshID Test RP</title>` +
      `<body style="font-family:system-ui;max-width:52rem;margin:3rem auto;padding:0 1rem;line-height:1.6">${body}</body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

function pre(label: string, value: unknown): string {
  return `<h2>${label}</h2><pre style="background:#f4f4f5;padding:1rem;border-radius:.75rem;overflow:auto">${
    JSON.stringify(value, null, 2)
  }</pre>`;
}

const server = Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/login") {
      const codeVerifier = client.randomPKCECodeVerifier();
      const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
      const state = client.randomState();
      const nonce = client.randomNonce();

      pending.set(state, { codeVerifier, nonce });

      const authorizationUrl = client.buildAuthorizationUrl(config, {
        redirect_uri: REDIRECT_URI,
        scope: SCOPE,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state,
        nonce,
      });

      return Response.redirect(authorizationUrl.href, 302);
    }

    if (url.pathname === "/callback") {
      const state = url.searchParams.get("state");
      const saved = state ? pending.get(state) : undefined;

      if (!state || !saved) {
        return html("<h1>state が一致しません</h1><p>/login からやり直してください。</p>", 400);
      }
      pending.delete(state);

      try {
        const tokens = await client.authorizationCodeGrant(config, url, {
          pkceCodeVerifier: saved.codeVerifier,
          expectedState: state,
          expectedNonce: saved.nonce,
        });

        // ここに来た時点で ID トークンの署名・iss・aud・exp・nonce は
        // openid-client が検証済み。
        const claims = tokens.claims();

        let userInfo: unknown = "(取得していません)";
        if (claims?.sub) {
          userInfo = await client.fetchUserInfo(config, tokens.access_token, claims.sub);
        }

        let refreshed: unknown = "(refresh_token が発行されていません)";
        if (tokens.refresh_token) {
          const next = await client.refreshTokenGrant(config, tokens.refresh_token);
          refreshed = {
            access_token: `${next.access_token.slice(0, 12)}…`,
            token_type: next.token_type,
            expires_in: next.expiresIn(),
          };
        }

        return html(
          `<h1>ログインに成功しました</h1>` +
            pre("ID トークンのクレーム（検証済み）", claims) +
            pre("UserInfo", userInfo) +
            pre("リフレッシュ結果", refreshed) +
            `<p><a href="/login">もう一度試す</a></p>`,
        );
      } catch (error) {
        return html(
          `<h1>検証に失敗しました</h1><pre>${String(error)}</pre>` +
            `<p><a href="/login">やり直す</a></p>`,
          400,
        );
      }
    }

    return html("<h1>HoshID Test RP</h1><p><a href='/login'>ログインを開始</a></p>");
  },
});

console.log(`\ntest RP listening on http://127.0.0.1:${server.port}/login\n`);
