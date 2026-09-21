/**
 * 認証方法（amr）と認証強度（acr）の表現。
 *
 * **標準の `acr` / `amr` クレームは ID トークンに出せない。**
 * `@better-auth/oauth-provider` は両方を予約クレームとして扱い、
 * `customIdTokenClaims` や拡張から返した値を捨てたうえで `acr: "0"` を
 * 固定で入れる（`stripReservedIdTokenClaims` を参照）。
 *
 * そのため HoshID では名前空間付きの独自クレームとして出す。RP は
 * `hoshid_amr` / `hoshid_acr` を読むこと。ライブラリ側が対応したら
 * 標準クレームへ移行する。
 */

export const AMR_CLAIM = "hoshid_amr";
export const ACR_CLAIM = "hoshid_acr";

/** RFC 8176 の値に合わせる。 */
export const AMR = {
  /** パスワード。 */
  password: "pwd",
  /** 時刻ベースのワンタイムパスワード（認証アプリ）。 */
  otp: "otp",
  /** 多要素を通過した。 */
  mfa: "mfa",
  /** 所持している鍵による認証（WebAuthn / パスキー）。 */
  hardwareKey: "hwk",
  /** 利用者の確認（生体認証や PIN）を伴った。 */
  userPresence: "user",
} as const;

/**
 * 認証強度。RP はこの値で「どこまで確認された利用者か」を判断する。
 *
 * 数値が大きいほど強い、という単純な順序にしている。
 */
export const ACR = {
  /** 単一要素（パスワードのみ）。 */
  single: "hoshid:1fa",
  /** 二要素、またはパスキー単体（所持＋利用者確認）。 */
  multi: "hoshid:2fa",
} as const;

export const ACR_VALUES_SUPPORTED = [ACR.single, ACR.multi];

/**
 * セッションが作られたエンドポイントから認証方法を推定する。
 *
 * Better Auth は認証方法をセッションに残さないため、どの経路で
 * セッションが生まれたかで判断する。未知の経路は単一要素として扱う。
 * **強い方に倒さないこと。** 判断できないものを 2FA 相当とみなすと、
 * RP が実際より強い保証があると誤解する。
 */
export function amrFromPath(path: string | null | undefined): string[] {
  if (!path) return [AMR.password];

  if (path.includes("/passkey/")) {
    // パスキーは「鍵の所持」に加えて端末側の生体認証／PIN を伴う。
    return [AMR.hardwareKey, AMR.userPresence, AMR.mfa];
  }

  if (path.includes("/two-factor/verify-totp")) {
    return [AMR.password, AMR.otp, AMR.mfa];
  }

  if (path.includes("/two-factor/verify-otp")) {
    // メールで届くコード。所持の証明としては弱いが二要素ではある。
    return [AMR.password, AMR.otp, AMR.mfa];
  }

  if (path.includes("/two-factor/verify-backup-code")) {
    return [AMR.password, AMR.mfa];
  }

  return [AMR.password];
}

export function acrFromAmr(amr: string[]): string {
  return amr.includes(AMR.mfa) ? ACR.multi : ACR.single;
}

/** セッションには文字列で持つ。読み出しはこの関数を通す。 */
export function parseAmr(value: string | null | undefined): string[] {
  if (!value) return [AMR.password];
  return value.split(" ").filter(Boolean);
}

export function serializeAmr(amr: string[]): string {
  return amr.join(" ");
}
