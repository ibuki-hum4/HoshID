// better-auth の username プラグインの既定値（最小/最大長・許容文字）と一致させること。
// frontend/node_modules/better-auth/dist/plugins/username/index.mjs 参照。
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * カスタムID（username）の形式を検証する。
 * 問題なければ null、問題があればユーザー向けのエラーメッセージを返す。
 */
export function validateUsernameFormat(value: string): string | null {
  if (value.length < USERNAME_MIN_LENGTH) {
    return `カスタムIDは${USERNAME_MIN_LENGTH}文字以上で入力してください。`;
  }
  if (value.length > USERNAME_MAX_LENGTH) {
    return `カスタムIDは${USERNAME_MAX_LENGTH}文字以内で入力してください。`;
  }
  if (!USERNAME_PATTERN.test(value)) {
    return "カスタムIDは半角英数字・アンダースコア(_)・ピリオド(.)のみ使用できます。";
  }
  return null;
}
