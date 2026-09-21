/**
 * DB に入っている暗号文を、いまの秘密で全部読めるか確かめる。
 *
 *   bun run verify:secrets
 *
 * **バックアップから復元した直後に必ず流すこと。** HoshID の DB は
 * `BETTER_AUTH_SECRET` で暗号化された値を含んでいて、ダンプと秘密が食い違うと
 * 復元は成功したように見えるのに中身が読めない。その状態は次のような形で
 * 現れる。
 *
 *   - ログインしようとした利用者が二要素認証で詰まる
 *   - トークン発行時に「秘密鍵を復号できない」で落ちる
 *
 * どちらも**利用者が踏んで初めて分かる**ので、復元した人は気づけない。
 * ここで先に踏んでおく。
 *
 * 読むだけで、何も書き換えない。
 */
import { symmetricDecrypt } from "better-auth/crypto";

import { resolveSecretConfig } from "@/lib/jwks";
import { prisma } from "@/lib/prisma";

type Failure = { table: string; id: string; message: string };

async function main() {
  const secretConfig = resolveSecretConfig();
  const failures: Failure[] = [];
  let checked = 0;

  const read = async (table: string, id: string, data: string) => {
    checked += 1;
    try {
      await symmetricDecrypt({ key: secretConfig, data });
    } catch (error) {
      failures.push({ table, id, message: (error as Error).message });
    }
  };

  for (const row of await prisma.jwks.findMany({ select: { id: true, privateKey: true } })) {
    // jwks だけ JSON.stringify されて入っている。
    const stored: unknown = JSON.parse(row.privateKey);
    if (typeof stored === "string") await read("jwks", row.id, stored);
  }

  for (const row of await prisma.twoFactor.findMany({
    select: { id: true, secret: true, backupCodes: true },
  })) {
    await read("twoFactor.secret", row.id, row.secret);
    await read("twoFactor.backupCodes", row.id, row.backupCodes);
  }

  console.log(
    typeof secretConfig === "string"
      ? "ルート秘密: BETTER_AUTH_SECRET のみ"
      : `ルート秘密: 版 ${secretConfig.currentVersion} が現行（読める版: ${[...secretConfig.keys.keys()]
          .sort((a, b) => a - b)
          .join(", ")}${secretConfig.legacySecret ? " + 版なしの旧形式" : ""}）`,
  );
  console.log(`暗号文 ${checked} 件を確認しました。`);

  if (failures.length === 0) {
    console.log("すべて読めます。");
    return;
  }

  console.error(`\n${failures.length} 件を読めません:`);
  for (const failure of failures) {
    console.error(`  ${failure.table} ${failure.id}: ${failure.message}`);
  }
  console.error(
    "\nダンプを取った時点の秘密と、いま渡している秘密が食い違っています。" +
      "\n**この状態で運用を始めないでください。** 当時の値を BETTER_AUTH_SECRETS に" +
      "\n足せば読めるようになります。手順は docs/key-rotation.md。",
  );
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
