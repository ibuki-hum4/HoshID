/**
 * スクリプトが作った鍵を、サーバと同じ経路で使えるか確かめる。
 *
 *   bun run scripts/verify-jwks-roundtrip.ts
 *
 * 確かめること:
 *   1. 作った鍵の秘密鍵を、Better Auth と同じ復号で読めるか
 *      （読めないと `Failed to decrypt private key` でログインが落ちる）
 *   2. その秘密鍵で署名し、DB の公開鍵で検証できるか
 *   3. 別の鍵の公開鍵では検証が失敗するか（取り違えの検出）
 *
 * 確認用の鍵は最後に消すので、DB には何も残さない。
 */
import { symmetricDecrypt } from "better-auth/crypto";
import { generateExportedKeyPair } from "better-auth/plugins/jwt";
import { SignJWT, importJWK, jwtVerify } from "jose";

import { JWKS_KEY_PAIR_CONFIG, resolveSecretConfig } from "@/lib/jwks";
import { mintKey } from "@/lib/key-maintenance";
import { prisma } from "@/lib/prisma";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (ok) passed += 1;
  else failed += 1;
}

async function main() {
  const secretConfig = resolveSecretConfig();

  // 本番と同じ関数で作る。ここを書き写すと、本体を変えたときに検証だけが
  // 古い手順を通り続けて、壊れていることに気づけなくなる。
  const created = await mintKey();
  const alg = created.alg ?? JWKS_KEY_PAIR_CONFIG.alg;

  try {
    const stored = await prisma.jwks.findUniqueOrThrow({ where: { id: created.id } });

    // --- 1. サーバ（plugins/jwt/sign.ts）と同じ復号 ---
    const decrypted = await symmetricDecrypt({
      key: secretConfig,
      data: JSON.parse(stored.privateKey),
    });
    check("秘密鍵を Better Auth と同じ復号で読める", decrypted.startsWith("{"));

    // --- 2. 署名して、DB の公開鍵で検証できる ---
    const privateKey = await importJWK(JSON.parse(decrypted), alg);
    const token = await new SignJWT({ sub: "roundtrip" })
      .setProtectedHeader({ alg, kid: stored.id })
      .setIssuedAt()
      .setExpirationTime("1m")
      .sign(privateKey);

    const publicKey = await importJWK(JSON.parse(stored.publicKey), alg);
    const { protectedHeader } = await jwtVerify(token, publicKey);
    check("公開鍵で署名を検証できる", true);
    check("kid がヘッダに入る", protectedHeader.kid === stored.id);

    // --- 3. 別の鍵では検証が通らない ---
    const other = await generateExportedKeyPair({ jwks: { keyPairConfig: JWKS_KEY_PAIR_CONFIG } });
    const otherPublic = await importJWK(other.publicWebKey, alg);
    const rejected = await jwtVerify(token, otherPublic).then(
      () => false,
      () => true,
    );
    check("別の鍵の公開鍵では検証が失敗する", rejected);
  } finally {
    await prisma.jwks.delete({ where: { id: created.id } });
    console.log(`\n確認用の鍵 ${created.id} を削除しました。`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
