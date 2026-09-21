/**
 * 連携できる外部サービスの定義。
 *
 * **ここにサーバ専用の処理を書かないこと。** クライアントコンポーネント
 * （連携ボタン、アカウント設定）が読むので、Prisma や node の API を持ち込むと
 * ブラウザ向けバンドルに巻き込まれてビルドが落ちる。OAuth の往復と
 * プロフィール取得は `lib/social.ts`（サーバ専用）にある。
 */

export const SOCIAL_PROVIDERS = ["discord", "github"] as const;

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export function isSocialProvider(value: unknown): value is SocialProvider {
  return (
    typeof value === "string" && (SOCIAL_PROVIDERS as readonly string[]).includes(value)
  );
}

export type SocialProviderMeta = {
  label: string;
  /** 何のために繋ぐのかを、画面で一言で説明する。 */
  purpose: string;
  /** 申請のときに求めるか。求めないものはアカウント設定からのみ繋ぐ。 */
  requestedAtApplication: boolean;
  /**
   * 1人が複数のアカウントを繋げるか。
   *
   * Discord は複数。本アカウントとサブを両方繋ぎたい、といった使い方がある。
   * GitHub はプロフィールに出す性質のもので、複数あるとどれを出すのか
   * 決められないため1つに絞る（DB 側も部分ユニークインデックスで縛っている）。
   */
  allowsMultiple: boolean;
};

export const SOCIAL_PROVIDER_META: Record<SocialProvider, SocialProviderMeta> = {
  discord: {
    label: "Discord",
    purpose: "申請者が誰かを確かめるために使います。表示名とアイコンを取得します。",
    requestedAtApplication: true,
    allowsMultiple: true,
  },
  github: {
    label: "GitHub",
    purpose: "プロフィールに表示できます。草を出すかどうかは後から選べます。",
    requestedAtApplication: false,
    allowsMultiple: false,
  },
};

/** プロフィールに出す、連携の表示用の形。 */
export type SocialLinkView = {
  id: string;
  provider: SocialProvider;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  showContributions: boolean;
  /** Discord のサーバに参加しているか。null は未確認、GitHub では常に null。 */
  inGuild: boolean | null;
};

/** GitHub の草。1日1マス。 */
export type ContributionDay = {
  /** YYYY-MM-DD */
  date: string;
  count: number;
  /** 0〜4。GitHub の配色と同じ段階。 */
  level: 0 | 1 | 2 | 3 | 4;
};

export type Contributions = {
  total: number;
  /** 日曜始まりの週の配列。各週は最大7日。 */
  weeks: ContributionDay[][];
  from: string;
  to: string;
};
