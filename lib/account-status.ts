/**
 * アカウントのライフサイクル。HoshID は自由なアカウント作成を許さず、
 * 申請 → 承認を経たものだけがログインできる。
 */
export const ACCOUNT_STATUS = {
  /** 申請済み・未審査。ログイン不可。 */
  pending: "pending",
  /** 承認済み。ログイン可能。 */
  approved: "approved",
  /** 却下済み。ログイン不可。 */
  rejected: "rejected",
} as const;

export type AccountStatus =
  (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];

export function isAccountStatus(value: unknown): value is AccountStatus {
  return (
    typeof value === "string" &&
    Object.values(ACCOUNT_STATUS).includes(value as AccountStatus)
  );
}
