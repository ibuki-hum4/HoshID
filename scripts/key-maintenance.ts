/**
 * デプロイのたびに走らせる、鍵まわりの保守処理。
 *
 *   bun run keys:maintain
 *
 * マイグレーションと同じ場所（k8s の Job、compose の起動前）に置くことを
 * 想定している。**Pod に exec で入って手で叩く運用にしないため**にある。
 *
 * ここでやるのは、次の3つだけ。どれも**何度実行してもよく、実行しても
 * 利用者に影響が出ない**。
 *
 *   1. 期限の無い鍵に期限を打つ（これを忘れると自動ローテーションが
 *      一生始まらない。しかもエラーは何も出ない）
 *   2. 古い版のままの暗号文を現行版へ書き換える（これを通さないと
 *      古い秘密を捨てられない）
 *   3. 公開の終わった鍵の行を消す
 *
 * **鍵の交換（--rotate）と失効（--revoke）はここでやらない。** 交換は
 * 期限が来れば Better Auth が勝手に行うし、失効は人が判断すべきこと。
 * デプロイのたびに鍵が変わる状態にはしない。
 *
 * 終了コード:
 *   0  正常（対処が要る状態を見つけた場合も含む。警告として出す）
 *   1  DB に触れないなど、保守処理そのものが失敗した
 *
 * 暗号文を読めない行があってもデプロイは止めない。既に壊れている行であり、
 * 止めても直らない。代わりに警告として必ず出す。
 */
import { inspectKeys } from "@/lib/key-health";
import { adoptKeys, pruneKeys, reencryptSecrets } from "@/lib/key-maintenance";
import { prisma } from "@/lib/prisma";

function log(message: string) {
  console.log(`[HoshID][keys] ${message}`);
}

async function main() {
  const now = new Date();

  // --- 1. 期限の無い鍵を予定に乗せる ---
  const adopted = await adoptKeys(now);
  for (const key of adopted) {
    log(
      `${key.id} に署名期限 ${key.expiresAt.toISOString()} を設定しました。` +
        (key.overdue ? " 既に過ぎているため、次の署名で新しい鍵が作られます。" : ""),
    );
  }
  if (adopted.length === 0) log("期限の無い鍵はありません。");

  // --- 2. 古い版の暗号文を現行版へ ---
  const reencrypted = await reencryptSecrets();
  if (reencrypted.mode === "single") {
    log("ルート秘密は版を使っていません（BETTER_AUTH_SECRET のみ）。");
  } else {
    const converted = reencrypted.jwks.converted + reencrypted.twoFactor.converted;
    log(
      `ルート秘密は版 ${reencrypted.currentVersion} が現行。` +
        (converted > 0 ? `${converted} 件を現行版へ書き換えました。` : "書き換えは不要でした。"),
    );

    for (const failure of reencrypted.failures) {
      console.warn(
        `[HoshID][keys] 警告: ${failure.table} ${failure.id} を復号できません: ${failure.message}`,
      );
    }
    if (reencrypted.failures.length > 0) {
      console.warn(
        "[HoshID][keys] 警告: 読めない暗号文があります。**古い版の秘密をまだ外さないでください。**",
      );
    }
  }

  // --- 3. 公開の終わった鍵を片付ける ---
  const pruned = await pruneKeys(now);
  log(pruned.length > 0 ? `公開の終わった鍵 ${pruned.length} 本を削除しました。` : "削除できる鍵はありません。");

  // --- 残った問題を警告として出す ---
  const health = await inspectKeys(new Date());
  for (const issue of health.issues) {
    const line = `${issue.summary} → ${issue.action}`;
    if (issue.level === "warn") console.warn(`[HoshID][keys] 警告: ${line}`);
    else log(line);
  }

  const signing = health.keys.find((key) => key.state === "signing");
  log(
    signing
      ? `署名鍵: ${signing.id}（期限 ${signing.expiresAt?.toISOString() ?? "なし"}）`
      : "署名できる鍵がありません。最初のトークン発行時に作られます。",
  );
}

main()
  .catch((error) => {
    console.error("[HoshID][keys] 保守処理に失敗しました:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
