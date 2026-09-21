/**
 * 署名鍵（JWKS）の状態確認と、人が判断して行う操作。
 *
 *   bun run jwks                  いまの鍵の状態を表示する（何も変えない）
 *   bun run jwks --adopt          期限の無い鍵を、ローテーションの予定に乗せる
 *   bun run jwks --rotate         いまの鍵を退役させ、新しい鍵に切り替える
 *   bun run jwks --revoke <kid>   鍵を即座に削除する（漏洩したときだけ）
 *   bun run jwks --prune          公開が終わった鍵の行を消す
 *
 * 平常時はこのスクリプトを使う必要はない。`lib/auth.ts` の `rotationInterval`
 * により、期限が切れれば Better Auth が自動で次の鍵を作る。`--adopt` と
 * `--prune` はデプロイ時の保守処理（`bun run keys:maintain`）でも走る。
 *
 * 鍵は毎回 DB から読まれるので、実行後にサーバを再起動する必要はない。
 */
import { JWKS_GRACE_PERIOD_SECONDS } from "@/lib/jwks";
import { inspectKeys, type KeyHealth } from "@/lib/key-health";
import { adoptKeys, pruneKeys, revokeKey, rotateKeys } from "@/lib/key-maintenance";
import { prisma } from "@/lib/prisma";

const STATE_LABEL = {
  signing: "署名中",
  grace: "検証のみ（JWKS に公開）",
  retired: "公開終了（削除してよい）",
} as const;

function formatDate(date: Date | null): string {
  return date ? date.toLocaleString("ja-JP") : "なし";
}

function printIssues(health: KeyHealth) {
  if (health.issues.length === 0) return;

  console.log("");
  for (const issue of health.issues) {
    console.log(`${issue.level === "warn" ? "要対処" : "参考  "}  ${issue.summary}`);
    console.log(`        → ${issue.action}`);
  }
}

async function printStatus(now: Date) {
  const health = await inspectKeys(now);

  if (health.keys.length === 0) {
    console.log("鍵がまだありません。最初のトークン発行時か、/jwks への最初の要求で作られます。");
    return;
  }

  console.log(`鍵は ${health.keys.length} 本あります。\n`);

  for (const key of health.keys) {
    console.log(`  kid        ${key.id}`);
    console.log(`  状態       ${STATE_LABEL[key.state]}`);
    console.log(`  方式       ${key.alg ?? "(未記録)"}${key.crv ? ` / ${key.crv}` : ""}`);
    console.log(`  作成       ${formatDate(key.createdAt)}`);
    console.log(`  署名の期限 ${formatDate(key.expiresAt)}`);
    console.log(
      `  公開の期限 ${key.publishedUntil ? formatDate(key.publishedUntil) : "なし（--adopt で予定に乗せられます）"}`,
    );
    console.log("");
  }

  const { secrets } = health;
  if (secrets.mode === "versioned") {
    console.log(
      `ルート秘密: 版 ${secrets.currentVersion} が現行（読める版: ${secrets.knownVersions.join(", ")}）`,
    );
    console.log(
      `  暗号文 ${secrets.ciphertexts.total} 件のうち、` +
        `古い版 ${secrets.ciphertexts.stale} 件 / 版なし ${secrets.ciphertexts.unversioned} 件`,
    );
  } else {
    console.log("ルート秘密: BETTER_AUTH_SECRET のみ（版を使っていません）");
  }

  printIssues(health);
}

async function adopt(now: Date) {
  const adopted = await adoptKeys(now);

  if (adopted.length === 0) {
    console.log("期限の無い鍵はありません。何もしませんでした。");
    return;
  }

  for (const key of adopted) {
    console.log(
      `${key.id} の署名期限を ${formatDate(key.expiresAt)} にしました。` +
        (key.overdue ? " 既に過ぎているため、次の署名で新しい鍵が作られます。" : ""),
    );
  }
}

async function rotate(now: Date) {
  const { created, retired } = await rotateKeys(now);

  console.log(`新しい鍵を作りました: ${created.id}`);
  console.log(`  署名の期限 ${formatDate(created.expiresAt)}`);

  for (const key of retired) {
    console.log(`${key.id} を退役させました。${formatDate(key.publishedUntil)} まで JWKS に残ります。`);
  }

  console.log("\nRP 側は未知の kid を見た時点で JWKS を取り直します。設定変更は不要です。");
}

async function revoke(kid: string, now: Date) {
  const result = await revokeKey(kid, now);

  if (!result.ok) {
    console.error(`kid "${kid}" の鍵が見つかりません。`);
    process.exitCode = 1;
    return;
  }

  if (result.replacement) {
    console.log(`代わりの鍵を作りました: ${result.replacement.id}`);
  }

  console.log(`${kid} を削除しました。この鍵で署名されたトークンは全て検証できなくなります。`);
  console.log("RP 側で認証のやり直しが必要になります。");
}

async function prune(now: Date) {
  const pruned = await pruneKeys(now);

  if (pruned.length === 0) {
    console.log("削除できる鍵はありません。");
    return;
  }

  for (const id of pruned) {
    console.log(`${id} を削除しました（公開期限を ${JWKS_GRACE_PERIOD_SECONDS / 86400} 日超過）。`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const now = new Date();

  if (args.includes("--adopt")) {
    await adopt(now);
  } else if (args.includes("--rotate")) {
    await rotate(now);
  } else if (args.includes("--revoke")) {
    const kid = args[args.indexOf("--revoke") + 1];
    if (!kid) {
      console.error("--revoke には kid を渡してください。");
      process.exitCode = 1;
      return;
    }
    await revoke(kid, now);
  } else if (args.includes("--prune")) {
    await prune(now);
  } else {
    await printStatus(now);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
