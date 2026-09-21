/**
 * Discord の Gateway に繋ぎ続けるだけの常駐プロセス。
 *
 *   bun run bot
 *
 * **これは見た目のためだけにある。** Discord がメンバー一覧で Bot を
 * オンライン表示するのは Gateway に繋いでいる間だけで、REST を叩いても
 * オンラインにはならない。
 *
 * **機能はここに置かない。** ロールの付け外しは承認・却下・ステータス変更・
 * 連携の追加と解除のたびに、その場で REST から行っている（`lib/discord-role.ts`）。
 * ここに処理を足すと、同じことをする経路が2つになって、片方だけ直す事故が起きる。
 * ずれの修正は `bun run discord:sync`（CronJob）の仕事。
 *
 * **DB にも触らない。** 触らないので、アプリとは独立に落ちても構わない。
 */
import { REST } from "@discordjs/rest";
import { WebSocketManager, WebSocketShardEvents } from "@discordjs/ws";
import {
  GatewayIntentBits,
  PresenceUpdateStatus,
  ActivityType,
} from "discord-api-types/v10";

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error("[HoshID][bot] DISCORD_BOT_TOKEN が未設定です。");
  process.exit(1);
}

const rest = new REST().setToken(token);

const manager = new WebSocketManager({
  token,
  rest,
  // **インテントは要求しない。** オンライン表示に権限は要らず、
  // メッセージもメンバーの出入りも読まない。開発者ポータルで特権インテントを
  // 有効にする必要も無い。
  intents: 0 as GatewayIntentBits,

  initialPresence: {
    since: null,
    afk: false,
    status: PresenceUpdateStatus.Online,
    activities: [
      {
        name: "HoshID",
        // 「〜をプレイ中」ではなく素の文言にする。
        type: ActivityType.Custom,
        state: "アカウントの管理",
      },
    ],
  },
});

manager.on(WebSocketShardEvents.Ready, (payload) => {
  const user = payload.user;
  console.log(`[HoshID][bot] 接続しました: ${user.username} (${user.id})`);
});

manager.on(WebSocketShardEvents.Closed, (code) => {
  // 再接続は WebSocketManager が面倒を見る。ここでは起きたことだけ残す。
  console.warn(`[HoshID][bot] 接続が切れました（code ${code}）。再接続します。`);
});

manager.on(WebSocketShardEvents.Error, (error) => {
  console.warn("[HoshID][bot] エラー:", error.message);
});

// k8s から止められたら黙って閉じる。
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`[HoshID][bot] ${signal} を受け取りました。切断します。`);
    void Promise.resolve(manager.destroy()).finally(() => process.exit(0));
  });
}

await manager.connect();
