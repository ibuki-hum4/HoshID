import type { SecretConfig } from "better-auth/crypto";

/**
 * 署名鍵（JWKS）の運用方針。
 *
 * `lib/auth.ts` の `jwt()` と `scripts/rotate-jwks.ts` の両方がここを読む。
 * 片方だけ変えると、手で作った鍵と自動で作られた鍵で寿命が食い違う。
 *
 * ここにサーバ専用の処理を書かないこと。定数と純粋な関数だけに保つ。
 */

/** EdDSA / Ed25519。署名が短く、検証も速い。 */
export const JWKS_KEY_PAIR_CONFIG = { alg: "EdDSA", crv: "Ed25519" } as const;

/**
 * 1本の鍵が「署名に使われる」期間。
 *
 * Better Auth は鍵を作るとき `expiresAt = createdAt + この値` を打ち、署名時
 * には期限内で最も新しい鍵を選ぶ。全ての鍵が期限切れになると、その場で新しい
 * 鍵を作る。つまりこの値を入れるだけで自動ローテーションになる。
 */
export const JWKS_ROTATION_INTERVAL_SECONDS = 60 * 60 * 24 * 90; // 90日

/**
 * 署名をやめた鍵を、JWKS に公開し続ける期間。
 *
 * **発行済みトークンの最大寿命より必ず長くすること。** 短くすると、まだ
 * 有効期限内のトークンが「署名した鍵が JWKS に無い」という理由で突然
 * 弾かれる。RP 側からは原因が全く見えない壊れ方をする。
 *
 * HoshID で最も長生きする署名済みトークンは **ID トークンの10時間**
 * （`idTokenExpiresIn` の既定値。アクセストークンは1時間、リフレッシュ
 * トークンは JWKS で署名しない DB 上の値なので無関係）。7日はその16倍
 * あり、RP 側の JWKS キャッシュが多少古くても吸収できる。
 *
 * `idTokenExpiresIn` を延ばすなら、この値も併せて見直すこと。
 */
export const JWKS_GRACE_PERIOD_SECONDS = 60 * 60 * 24 * 7; // 7日

/** 鍵がいま JWKS と署名でどう扱われているか。 */
export type JwkState =
  | "signing" // 署名に使われる
  | "grace" // 署名はしないが、検証のため JWKS に残っている
  | "retired"; // JWKS からも消えた。行を消してよい

export function classifyJwk(
  key: { expiresAt: Date | null },
  options: { isLatestLive: boolean; now?: Date },
): JwkState {
  const now = options.now ?? new Date();

  if (!key.expiresAt || key.expiresAt > now) {
    // 期限内でも、より新しい鍵があればそちらが署名に使われる。
    return options.isLatestLive ? "signing" : "grace";
  }

  const publishedUntil = key.expiresAt.getTime() + JWKS_GRACE_PERIOD_SECONDS * 1000;
  return publishedUntil > now.getTime() ? "grace" : "retired";
}

/**
 * 秘密鍵の暗号化に使う鍵を、Better Auth と同じ規則で組み立てる。
 *
 * Better Auth 本体はこれを内部で作るが、外部に出していない。鍵を手で
 * 作るスクリプトは同じ規則で暗号化しないと、サーバ側が復号できない鍵を
 * 生むことになるため、ここで作り直している。
 *
 * - `BETTER_AUTH_SECRETS` があればそちらが優先。`"<版>:<秘密>"` を
 *   カンマ区切りで並べ、**先頭が現行**。暗号文は `$ba$<版>$...` の形で
 *   保存されるので、古い版を残しておけば古いデータも読める。
 * - 無ければ `BETTER_AUTH_SECRET` をそのまま使う（旧来の形式。暗号文に
 *   版が付かない生の16進数になる）。
 */
export function resolveSecretConfig(
  env: Record<string, string | undefined> = process.env,
): string | SecretConfig {
  const legacySecret = env.BETTER_AUTH_SECRET || env.AUTH_SECRET || "";
  const raw = env.BETTER_AUTH_SECRETS;

  if (!raw) {
    if (!legacySecret) {
      throw new Error("BETTER_AUTH_SECRET も BETTER_AUTH_SECRETS も設定されていません。");
    }
    return legacySecret;
  }

  const keys = new Map<number, string>();
  let currentVersion: number | null = null;

  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    const separator = trimmed.indexOf(":");

    if (separator === -1) {
      throw new Error(
        `BETTER_AUTH_SECRETS の書式が不正です: "${trimmed}"。"<版>:<秘密>" の形で書くこと。`,
      );
    }

    const version = Number.parseInt(trimmed.slice(0, separator), 10);
    const value = trimmed.slice(separator + 1).trim();

    if (!Number.isInteger(version) || version < 0) {
      throw new Error(`BETTER_AUTH_SECRETS の版が不正です: "${trimmed}"。0以上の整数にすること。`);
    }
    if (!value) {
      throw new Error(`BETTER_AUTH_SECRETS の版 ${version} に秘密が入っていません。`);
    }
    if (keys.has(version)) {
      throw new Error(`BETTER_AUTH_SECRETS に版 ${version} が重複しています。`);
    }

    keys.set(version, value);
    currentVersion ??= version;
  }

  if (currentVersion === null) {
    throw new Error("BETTER_AUTH_SECRETS が空です。");
  }

  return {
    keys,
    currentVersion,
    // 版の付かない古い暗号文を読むための保険。BETTER_AUTH_SECRETS に
    // 移行しても、既存の行を読み終えるまでは消さないこと。
    legacySecret: legacySecret || undefined,
  };
}
