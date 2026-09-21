/**
 * アカウントのライフサイクル。
 *
 * HoshID は自由なアカウント作成を許さず、申請 → 承認を経たものだけが
 * ログインできる。**ログインできるのは `active` だけ**で、他は全て不可。
 */
export const ACCOUNT_STATUS = {
  /** 申請済み・未審査。アカウントの実体はあるがまだ使えない。 */
  prepared: "prepared",
  /** 承認済み。ログインできる唯一の状態。 */
  active: "active",
  /** 申請が却下された。 */
  rejected: "rejected",
  /** 承認されたが使われなくなり、こちらで停止した。 */
  archived: "archived",
  /** 規約違反などで停止した。 */
  suspended: "suspended",
} as const;

export type AccountStatus =
  (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];

export const ACCOUNT_STATUS_VALUES = Object.values(
  ACCOUNT_STATUS,
) as AccountStatus[];

export function isAccountStatus(value: unknown): value is AccountStatus {
  return (
    typeof value === "string" &&
    (ACCOUNT_STATUS_VALUES as string[]).includes(value)
  );
}

/**
 * ログインを許可してよい状態かどうか。
 *
 * **ここを緩めないこと。** セッション生成の可否がこの判定に依存しており、
 * 通してしまうと未承認・停止済みのアカウントで認可フローまで通ってしまう。
 */
export function canSignIn(status: string | null | undefined): boolean {
  return status === ACCOUNT_STATUS.active;
}

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  prepared: "Prepared",
  active: "Active",
  rejected: "Rejected",
  archived: "Archived",
  suspended: "Suspended",
};

export const ACCOUNT_STATUS_DESCRIPTIONS: Record<AccountStatus, string> = {
  prepared: "申請済み。承認されるとログインできます。",
  active: "承認済み。利用できます。",
  rejected: "申請が承認されませんでした。",
  archived: "使われなくなったため停止しています。",
  suspended: "規約違反などにより停止しています。",
};

/** バッジの見た目。承認済み以外は目立たせる。 */
export function accountStatusVariant(
  status: AccountStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case ACCOUNT_STATUS.active:
      return "secondary";
    case ACCOUNT_STATUS.rejected:
    case ACCOUNT_STATUS.suspended:
      return "destructive";
    case ACCOUNT_STATUS.archived:
      return "outline";
    default:
      return "default";
  }
}
