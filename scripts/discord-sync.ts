/**
 * Discord のロールを、HoshID の状態に合わせて揃える。
 *
 *   bun run discord:sync            何が変わるかを数えるだけ（既定）
 *   bun run discord:sync --apply    実際に変更する
 *
 * 平常時に実行する必要はない。承認・却下・ステータス変更・連携の追加と解除の
 * たびに、その場でロールは変わる（`lib/discord-role.ts`）。これは**ずれたときに
 * 直すためのもの**で、定期実行（k8s の CronJob など）に向いている。
 *
 * ずれる原因はいくつもある。
 *   - 承認した瞬間に Discord が落ちていた
 *   - 誰かが Discord 側で手作業でロールを付けた・外した
 *   - 連携したあとにサーバへ参加した（参加時点では HoshID は何も知らない）
 *
 * **メンバー一覧を1回読んで差分だけ叩く。** 全員に PUT を投げるとレート制限に
 * 当たるうえ、ほとんどが「既に付いている」ことの確認で終わって無駄になる。
 *
 * 必要な設定は DISCORD_BOT_TOKEN / DISCORD_GUILD_ID / DISCORD_MEMBER_ROLE_ID。
 * **開発者ポータルで Server Members Intent を有効にすること。** 無効だと
 * メンバー一覧を取得できない。
 */
import { isDiscordRoleSyncConfigured, reconcileDiscordRoles } from "@/lib/discord-role";
import { prisma } from "@/lib/prisma";

async function main() {
  if (!isDiscordRoleSyncConfigured()) {
    console.log(
      "Discord のロール同期は設定されていません" +
        "（DISCORD_BOT_TOKEN / DISCORD_GUILD_ID / DISCORD_MEMBER_ROLE_ID）。",
    );
    return;
  }

  // **既定は数えるだけ。** 突き合わせは「HoshID と繋がっていない人からロールを
  // 外す」動きを含む。そのロールが HoshID より前から使われていた場合、初回の
  // 実行で既存メンバー全員から剥がすことになる。何が起きるかを先に見せる。
  const apply = process.argv.includes("--apply");
  const result = await reconcileDiscordRoles({ dryRun: !apply });

  if (result.skipped) {
    // 原因は直前の警告に出ている。ここでは直す場所の当たりだけ示す。
    console.error("突き合わせできませんでした。上の警告に原因が出ています。");
    console.error("  404 なら Bot がサーバに参加していないか DISCORD_GUILD_ID が違う");
    console.error("  403 なら Server Members Intent か Manage Roles が足りない");
    process.exitCode = 1;
    return;
  }

  if (result.dryRun) {
    console.log("--- 数えただけです。Discord には何もしていません ---");
    console.log(`付与する: ${result.granted} 件 / 解除する: ${result.revoked} 件`);

    if (result.revoked > 0) {
      console.log("");
      console.log(
        `**${result.revoked} 人からロールを外すことになります。**` +
          " HoshID と連携していない人、または利用中でない人です。",
      );
      console.log(
        "そのロールを HoshID 以前から別の意味で使っていた場合、" +
          "この操作で全員から外れます。意図と合っているか確かめてください。",
      );
    }

    console.log("");
    console.log("実行するには --apply を付けてください。");
    return;
  }

  console.log(`付与: ${result.granted} 件 / 解除: ${result.revoked} 件`);

  if (result.notInGuild > 0) {
    console.log(
      `${result.notInGuild} 人は連携済みですがサーバにいません。` +
        "ロールは付けようがないので、本人に参加してもらう必要があります。",
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
