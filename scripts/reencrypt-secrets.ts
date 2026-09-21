/**
 * DB の暗号文を、現行版の秘密で暗号化し直す。
 *
 *   bun run secrets:reencrypt          書き換える
 *   bun run secrets:reencrypt --dry    何が対象かだけ見る
 *
 * **これを通さない限り、古い秘密は捨てられない。** 理由と対象は
 * `lib/key-maintenance.ts` の `reencryptSecrets` を参照。
 *
 * デプロイ時の保守処理（`bun run keys:maintain`）でも同じ処理が走るので、
 * 普段は手で実行する必要はない。
 */
import { reencryptSecrets, type ReencryptCounts } from "@/lib/key-maintenance";
import { prisma } from "@/lib/prisma";

async function main() {
  const dryRun = process.argv.includes("--dry");
  const result = await reencryptSecrets({ dryRun });

  if (result.mode === "single") {
    console.log("BETTER_AUTH_SECRETS を使っていないため、書き換える先の版がありません。");
    console.log("版を使い始める手順は docs/key-rotation.md を参照してください。");
    return;
  }

  console.log(
    `現行の版: ${result.currentVersion}（読める版: ${result.readableVersions.join(", ")}）`,
  );
  if (dryRun) console.log("--dry のため、DB は変更しません。");
  console.log("");

  const report = (label: string, counts: ReencryptCounts) => {
    console.log(
      `${label}: ${counts.converted} 件を${dryRun ? "書き換え対象として検出" : "書き換え"}、` +
        `${counts.skipped} 件は現行版のまま、${counts.failed} 件は失敗`,
    );
  };

  report("署名鍵", result.jwks);
  report("二要素認証", result.twoFactor);

  for (const failure of result.failures) {
    console.error(`  ${failure.table} ${failure.id}: ${failure.message}`);
  }

  if (result.failures.length > 0) {
    console.log(
      `\n${result.failures.length} 件を読めませんでした。**古い版の秘密をまだ外さないでください。**` +
        " 外すと、この行に関係する利用者が締め出されます。",
    );
    process.exitCode = 1;
    return;
  }

  if (!dryRun && result.jwks.converted + result.twoFactor.converted > 0) {
    console.log("\n全ての暗号文が現行版になりました。古い版を BETTER_AUTH_SECRETS から外せます。");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
