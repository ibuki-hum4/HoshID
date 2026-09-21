import { ACCOUNT_STATUS } from "@/lib/account-status";
import { prisma } from "@/lib/prisma";

/**
 * 利用中のメンバーに、Discord のロールを付ける。
 *
 * **OAuth のスコープではなく Bot の仕事。** ロールの付け外しは Bot トークンで
 * 行う。利用者側から追加で許可を取る必要はなく、連携時に得ている Discord の
 * ユーザー ID だけで足りる（`identify`）。
 *
 * Bot 側に必要なもの:
 *   - 対象のサーバに参加していること
 *   - `MANAGE_ROLES` 権限
 *   - **付けたいロールより上の位置にいること。** ここが満たされないと
 *     403 で失敗する。Discord の権限階層はロールの並び順で決まる
 *
 * **ロールの操作で HoshID 側の処理を巻き戻さない。** 承認できたのに Discord が
 * 落ちていて承認が取り消される方が困る。失敗は警告として残すだけにする。
 */

const API = "https://discord.com/api/v10";

/**
 * 呼び出しの結果。
 *
 * **「失敗」と「サーバにいない」を区別する。** 一緒くたにすると、ロールが
 * 付かなかった理由が「Bot の設定が悪い」のか「本人がサーバに入っていない」
 * のか分からず、直す相手を間違える。
 */
type CallResult = "ok" | "not-a-member" | "failed";

/** Discord API を1回だけ叩く。失敗しても投げない。 */
async function callDiscord(
  method: "PUT" | "DELETE" | "GET",
  path: string,
  reason?: string,
  retryOn429 = true,
): Promise<CallResult> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return "failed";

  try {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bot ${token}`,
        // 監査ログに理由が残る。誰が何のために変えたのかを Discord 側でも辿れる。
        //
        // **必ずエンコードする。** HTTP ヘッダは Latin-1 しか運べないので、
        // 日本語をそのまま入れると fetch が例外を投げ、**ロールの操作そのものが
        // 失敗する。** Discord はこのヘッダのパーセントエンコードを解く。
        ...(reason ? { "x-audit-log-reason": encodeURIComponent(reason) } : {}),
      },
      // Discord が詰まっているときに HoshID 側の操作を待たせない。
      signal: AbortSignal.timeout(5000),
    });

    // 204 はロール操作の成功、200 はメンバー情報の取得。
    if (response.status === 204 || response.status === 200) return "ok";

    // レート制限。Discord が待つべき秒数を教えてくれるので、それに従って
    // 一度だけやり直す。**待たずに諦めると、まとめて処理したときに後半が
    // 丸ごと落ちる**（実際に17件中7件が落ちた）。
    if (response.status === 429 && retryOn429) {
      const body = (await response.json().catch(() => null)) as {
        retry_after?: number;
      } | null;
      const waitMs = Math.min((body?.retry_after ?? 1) * 1000 + 100, 10_000);

      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return callDiscord(method, path, reason, false);
    }

    // こちらから直せない。本人にサーバへ入ってもらうしかない。
    if (response.status === 404) return "not-a-member";

    console.warn(
      `[HoshID][discord] 要求が通りませんでした（HTTP ${response.status}）: ${path}` +
        (response.status === 403
          ? " Bot の権限か、ロールの並び順を確認してください（Bot は付けたいロールより上にいる必要があります）。"
          : ""),
    );
    return "failed";
  } catch (error) {
    console.warn("[HoshID][discord] 要求に失敗しました:", error);
    return "failed";
  }
}

type RoleConfig = { guildId: string; roleId: string };

function roleConfig(): RoleConfig | null {
  const guildId = process.env.DISCORD_GUILD_ID;
  const roleId = process.env.DISCORD_MEMBER_ROLE_ID;
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!guildId || !roleId || !token) return null;
  return { guildId, roleId };
}

/** 設定が揃っているか。揃っていなければ何もしない（機能ごと無効）。 */
export function isDiscordRoleSyncConfigured(): boolean {
  return roleConfig() !== null;
}

async function applyRole(
  discordUserIds: string[],
  grant: boolean,
  reason: string,
): Promise<Map<string, CallResult>> {
  const config = roleConfig();
  const results = new Map<string, CallResult>();

  if (!config || discordUserIds.length === 0) return results;

  // **直列に投げる。** 一斉に投げるとレート制限に当たり、後半がまとめて
  // 失敗する。1人が複数の Discord アカウントを繋いでいることもあるが、
  // 全部に同じ扱いをする。
  for (const discordUserId of discordUserIds) {
    results.set(
      discordUserId,
      await callDiscord(
        grant ? "PUT" : "DELETE",
        `/guilds/${config.guildId}/members/${discordUserId}/roles/${config.roleId}`,
        reason,
      ),
    );
  }

  return results;
}

/**
 * うちのサーバにいるかどうかだけを調べる。
 *
 * **OAuth のスコープでは解かない。** `guilds` は「その人が入っている全サーバの
 * 一覧」を寄越すもので、yes/no が欲しいだけなのに他人のサーバ所属まで
 * 預かることになる。Bot に1つのサーバだけ問い合わせれば、追加の許可も
 * 余計なデータも要らない。
 */
export async function isGuildMember(discordUserId: string): Promise<boolean | null> {
  const config = roleConfig();
  if (!config) return null;

  const result = await callDiscord(
    "GET",
    `/guilds/${config.guildId}/members/${discordUserId}`,
  );

  if (result === "failed") return null;
  return result === "ok";
}

/** 参加状況を DB に写す。一覧から毎回 Discord に問い合わせないため。 */
async function recordMembership(results: Map<string, CallResult>): Promise<void> {
  const now = new Date();

  await Promise.all(
    [...results.entries()].map(([discordUserId, result]) => {
      // 失敗（Bot の設定不備やタイムアウト）は参加状況の情報ではない。
      // 上書きすると、直った後も「未参加」と表示され続ける。
      if (result === "failed") return null;

      return prisma.socialLink
        .updateMany({
          where: { provider: "discord", providerAccountId: discordUserId },
          data: { inGuild: result === "ok", guildCheckedAt: now },
        })
        .catch(() => null);
    }),
  );
}

async function linkedDiscordIds(userId: string): Promise<string[]> {
  const links = await prisma.socialLink
    .findMany({
      where: { userId, provider: "discord" },
      select: { providerAccountId: true },
    })
    .catch(() => []);

  return links.map((link) => link.providerAccountId);
}

/**
 * いまの状態に合わせてロールを付け直す。
 *
 * **ロールを持つのは `active` だけ。** ログインできる状態と一致させる。停止した
 * アカウントが Discord 側で利用者として扱われ続けるのを防ぐ。
 *
 * 承認・却下・ステータス変更・連携の追加や解除の後に呼ぶ。何度呼んでもよい。
 */
export async function syncDiscordRole(userId: string): Promise<void> {
  if (!isDiscordRoleSyncConfigured()) return;

  const user = await prisma.user
    .findUnique({ where: { id: userId }, select: { status: true } })
    .catch(() => null);

  const shouldHaveRole = user?.status === ACCOUNT_STATUS.active;

  const results = await applyRole(
    await linkedDiscordIds(userId),
    shouldHaveRole,
    shouldHaveRole ? "HoshID: 利用中のメンバー" : "HoshID: 利用できない状態になった",
  );

  await recordMembership(results);
}

/**
 * アカウントを消す前にロールを外す。
 *
 * **消した後では連携先が分からない。** 外部キーの CASCADE で連携も一緒に
 * 消えるため、先に Discord のユーザー ID を読んでおく必要がある。
 */
export async function revokeDiscordRoleBeforeDelete(userId: string): Promise<void> {
  if (!isDiscordRoleSyncConfigured()) return;

  await applyRole(await linkedDiscordIds(userId), false, "HoshID: アカウントが削除された");
}

/**
 * 1つの Discord アカウントについて、サーバにいるかを確かめて記録する。
 *
 * 連携した直後に呼ぶ。**ロールが付かない理由が「まだ承認されていない」のか
 * 「サーバにいない」のかを、本人にも管理者にも見えるようにする**ため。
 */
export async function recordGuildMembership(discordUserId: string): Promise<void> {
  if (!isDiscordRoleSyncConfigured()) return;

  const member = await isGuildMember(discordUserId);
  if (member === null) return;

  await prisma.socialLink
    .updateMany({
      where: { provider: "discord", providerAccountId: discordUserId },
      data: { inGuild: member, guildCheckedAt: new Date() },
    })
    .catch(() => null);
}

/** 連携を解除する前に、その1つ分だけロールを外す。 */
export async function revokeDiscordRoleForAccount(
  discordUserId: string,
): Promise<void> {
  if (!isDiscordRoleSyncConfigured()) return;

  await applyRole([discordUserId], false, "HoshID: 連携が解除された");
}

// --- 突き合わせ -------------------------------------------------------------

/**
 * ロールを持っているサーバのメンバーを全部読む。
 *
 * **この API には「サーバーメンバーインテント」が要る。** 開発者ポータルの
 * Bot → Privileged Gateway Intents → Server Members Intent を有効にしないと、
 * Gateway だけでなくこの REST 呼び出しも通らない。
 */
async function listGuildMemberRoles(): Promise<Map<string, string[]> | null> {
  const config = roleConfig();
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!config || !token) return null;

  const roles = new Map<string, string[]>();
  let after = "0";

  // 1000件ずつ。最後のページが 1000 未満になったら終わり。
  for (;;) {
    const response = await fetch(
      `${API}/guilds/${config.guildId}/members?limit=1000&after=${after}`,
      {
        headers: { authorization: `Bot ${token}` },
        signal: AbortSignal.timeout(15000),
      },
    ).catch(() => null);

    if (!response?.ok) {
      // **原因を決めつけない。** 同じ「取れない」でも直す場所が違う。
      const hint =
        response?.status === 404
          ? " Bot がそのサーバに参加していないか、DISCORD_GUILD_ID が違います。"
          : response?.status === 403
            ? " Bot の権限が足りません。Server Members Intent と Manage Roles を確認してください。"
            : "";

      console.warn(
        `[HoshID][discord] メンバー一覧を取得できませんでした（HTTP ${response?.status ?? "?"}）。${hint}`,
      );
      return null;
    }

    const page = (await response.json()) as {
      user?: { id: string };
      roles?: string[];
    }[];

    for (const member of page) {
      if (member.user?.id) roles.set(member.user.id, member.roles ?? []);
    }

    if (page.length < 1000) break;
    after = page.at(-1)?.user?.id ?? after;
  }

  return roles;
}

export type ReconcileResult = {
  granted: number;
  revoked: number;
  /** 連携済みだがサーバにいない人。ロールは付けようがない。 */
  notInGuild: number;
  skipped: boolean;
  /** true なら数えただけで、Discord には何もしていない。 */
  dryRun: boolean;
};

/**
 * DB とサーバの状態を突き合わせて、ロールをあるべき形に揃える。
 *
 * **1件ずつ問い合わせずに、先にメンバー一覧を1回読んで差分だけ叩く。** 全員に
 * PUT を投げるとレート制限に当たるうえ、ほとんどが「既に付いている」ことの
 * 確認で終わって無駄になる。
 *
 * Bot の起動時と定期実行、どちらからも呼べる。何度呼んでもよい。
 */
export async function reconcileDiscordRoles(
  options: { dryRun?: boolean } = {},
): Promise<ReconcileResult> {
  const dryRun = options.dryRun ?? false;

  const empty: ReconcileResult = {
    granted: 0,
    revoked: 0,
    notInGuild: 0,
    skipped: true,
    dryRun,
  };

  const config = roleConfig();
  if (!config) return empty;

  const memberRoles = await listGuildMemberRoles();
  if (!memberRoles) return empty;

  const links = await prisma.socialLink.findMany({
    where: { provider: "discord" },
    select: { userId: true, providerAccountId: true },
  });

  // SocialLink には Prisma のリレーションを張っていない（User モデルは
  // auth:schema が再生成するため）。状態は別に引いてくる。
  const activeUserIds = new Set(
    (
      await prisma.user.findMany({
        where: {
          id: { in: [...new Set(links.map((link) => link.userId))] },
          status: ACCOUNT_STATUS.active,
        },
        select: { id: true },
      })
    ).map((user) => user.id),
  );

  const shouldHave = new Set(
    links
      .filter((link) => activeUserIds.has(link.userId))
      .map((link) => link.providerAccountId),
  );

  const grant: string[] = [];
  const revoke: string[] = [];
  let notInGuild = 0;

  for (const discordUserId of shouldHave) {
    const roles = memberRoles.get(discordUserId);
    if (!roles) {
      notInGuild += 1;
      continue;
    }
    if (!roles.includes(config.roleId)) grant.push(discordUserId);
  }

  // 付いているのに持つべきでない人から外す。停止・却下・退会や、
  // HoshID と無関係に手で付けられたものもここで揃う。
  for (const [discordUserId, roles] of memberRoles) {
    if (roles.includes(config.roleId) && !shouldHave.has(discordUserId)) {
      revoke.push(discordUserId);
    }
  }

  if (dryRun) {
    return {
      granted: grant.length,
      revoked: revoke.length,
      notInGuild,
      skipped: false,
      dryRun: true,
    };
  }

  const granted = await applyRole(grant, true, "HoshID: 突き合わせ（利用中のメンバー）");
  const revoked = await applyRole(revoke, false, "HoshID: 突き合わせ（対象外）");

  const succeeded = (results: Map<string, CallResult>) =>
    [...results.values()].filter((result) => result === "ok").length;

  // 参加状況も同時に分かるので写しておく。
  await prisma.socialLink
    .updateMany({
      where: { provider: "discord", providerAccountId: { in: [...memberRoles.keys()] } },
      data: { inGuild: true, guildCheckedAt: new Date() },
    })
    .catch(() => null);

  // **実際に通った数を返す。** 投げた数を返すと、全部失敗していても
  // 「17件解除しました」と報告することになる（実際にそれで嘘をついた）。
  return {
    granted: succeeded(granted),
    revoked: succeeded(revoked),
    notInGuild,
    skipped: false,
    dryRun: false,
  };
}

/**
 * Discord のユーザー ID から HoshID の利用者を引いて、ロールを揃える。
 *
 * **サーバに後から入ってきた人のための口。** 連携だけ済ませて参加していな
 * かった人は、参加した瞬間にここを通る。これが無いと、次の突き合わせまで
 * ロールが付かない。
 */
export async function syncDiscordRoleByDiscordId(discordUserId: string): Promise<void> {
  if (!isDiscordRoleSyncConfigured()) return;

  const link = await prisma.socialLink
    .findUnique({
      where: { provider_providerAccountId: { provider: "discord", providerAccountId: discordUserId } },
      select: { userId: true },
    })
    .catch(() => null);

  // HoshID と無関係の人。何もしない。
  if (!link) return;

  await syncDiscordRole(link.userId);
}
