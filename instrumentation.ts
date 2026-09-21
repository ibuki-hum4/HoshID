/**
 * サーバ起動時に一度だけ走る処理（Next.js の instrumentation）。
 *
 * いまのところ用途は鍵の健康診断ひとつ。**鍵の問題は放っておいても何も
 * 起きないのが厄介なところ**で、自動ローテーションが始まっていなくても、
 * 古い秘密を捨てられないままでも、画面は普通に動き続ける。起動のたびに
 * 点検して、問題があればログに出す。
 *
 * ここでは**何も書き換えない**。修正は `bun run keys:maintain`（デプロイ時の
 * 保守処理）の仕事。起動するたびに DB を書き換える作りにすると、Pod が
 * 増減するだけで書き込みが走ることになる。
 */
export async function register() {
  // Edge ランタイムには Prisma が載らない。Node 側でだけ動かす。
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // プロキシの後ろに置いているかはここからは分からないので、断定はしない。
  // ただし本番で未設定なら、レート制限が壊れている可能性が高い。
  if (process.env.NODE_ENV === "production" && !process.env.TRUSTED_PROXIES) {
    console.warn(
      "[HoshID][net] TRUSTED_PROXIES が未設定です。" +
        "Ingress やロードバランサの後ろに置いている場合、クライアント IP を特定できず、" +
        "レート制限が全員で1つのバケツになります（ログインは10秒3回）。" +
        "詳細は lib/request-ip.ts。",
    );
  }

  try {
    const { inspectKeys } = await import("@/lib/key-health");
    const health = await inspectKeys();

    for (const issue of health.issues) {
      const line = `[HoshID][keys] ${issue.summary} → ${issue.action}`;
      if (issue.level === "warn") console.warn(line);
      else console.info(line);
    }
  } catch (error) {
    // 起動時に DB が来ていないことはある。点検に失敗してもサーバは
    // 立ち上げる。ここで落とすと、DB の遅延起動が「アプリが起動しない」
    // という形で現れて原因が分かりにくくなる。
    console.warn("[HoshID][keys] 鍵の点検をできませんでした:", error);
  }
}
