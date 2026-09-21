/**
 * 検証用の OAuth クライアントを1つ登録する。
 *
 *   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... bun run scripts/seed-client.ts
 *
 * クライアント登録は管理者権限が要るので、seed-admin で作った管理者として
 * サインインし、そのセッションで登録する。発行された client_id /
 * client_secret は標準出力に出す（secret は登録時にしか取得できない）。
 */
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// "localhost" は loopback と見なされず https を要求されるため、RFC 8252 の
// 推奨どおりループバックの IP リテラルを使う。
const REDIRECT_URI =
  process.env.SEED_CLIENT_REDIRECT_URI ?? "http://127.0.0.1:4000/callback";
const CLIENT_NAME = process.env.SEED_CLIENT_NAME ?? "HoshID Test RP";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

/** サインインして Cookie ヘッダを組み立てる。 */
async function signInAsAdmin(): Promise<Headers> {
  const response = await auth.api.signInEmail({
    body: {
      email: requireEnv("SEED_ADMIN_EMAIL"),
      password: requireEnv("SEED_ADMIN_PASSWORD"),
    },
    asResponse: true,
  });

  if (!response.ok) {
    throw new Error(`sign-in failed: ${response.status} ${await response.text()}`);
  }

  const setCookie = response.headers.getSetCookie();
  if (setCookie.length === 0) {
    // 承認されていない管理者だとセッションが作られずここに来る。
    throw new Error("sign-in returned no session cookie — is the admin approved?");
  }

  const cookie = setCookie.map((entry) => entry.split(";", 1)[0]).join("; ");
  return new Headers({ cookie });
}

async function main() {
  const headers = await signInAsAdmin();

  const client = await auth.api.adminCreateOAuthClient({
    headers,
    body: {
      client_name: CLIENT_NAME,
      redirect_uris: [REDIRECT_URI],
      // 明示しないと許可スコープが空になり、認可時に invalid_scope で弾かれる。
      scope: "openid profile email offline_access",
      // http のループバックを redirect_uri に使えるのは native だけ。
      // "web" は https かつ非ループバックしか受け付けない。
      application_type: "native",
      // 無期限。検証用なので回転させない。
      client_secret_expires_at: 0,
      // M1 は同意画面の動作確認をしたいので信頼済みにはしない。
      skip_consent: false,
    },
  });

  console.log("\n--- OAuth client registered ---");
  console.log(JSON.stringify(client, null, 2));
  console.log("\nclient_secret はこの出力でしか取得できない。テスト RP に控えること。");

  // CI から使うための逃げ道。標準出力は人が読む前提の形なので、機械に渡す
  // ときはここでファイルに書く。**本番で使わないこと。** client_secret が
  // 平文でディスクに残る。
  const outputPath = process.env.SEED_CLIENT_OUTPUT;
  if (outputPath) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(
      outputPath,
      JSON.stringify(
        {
          HOSHID_CLIENT_ID: client.client_id,
          HOSHID_CLIENT_SECRET: client.client_secret,
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(`資格情報を ${outputPath} に書き出しました。`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
