/**
 * 認可フローの途中で認証画面へ飛ばされたときの復帰処理。
 *
 * oauthProvider は /oauth2/authorize の問い合わせ内容を署名付きクエリ
 * （`sig` / `exp` / `signedQueryIssuedAtMs` を含む）にして loginPage や
 * consentPage へ渡してくる。画面側はそれを**一切変えずに**
 * /oauth2/authorize へ返すことでフローが続く。
 *
 * パラメータを落としたり並べ替えたりすると署名検証に失敗してフローが切れる。
 */

/** Better Auth のハンドラのマウント先。 */
const AUTHORIZE_PATH = "/api/auth/oauth2/authorize";

/** 署名付きクエリかどうかの判定に使う、必ず存在するパラメータ。 */
const SIGNATURE_PARAM = "sig";
const CLIENT_ID_PARAM = "client_id";

export function isOAuthFlow(
  params: URLSearchParams | ReadonlyURLSearchParamsLike,
): boolean {
  return Boolean(params.get(SIGNATURE_PARAM) && params.get(CLIENT_ID_PARAM));
}

/**
 * 認可フローの途中なら復帰先の URL を返す。そうでなければ null。
 */
export function buildAuthorizeUrl(
  params: URLSearchParams | ReadonlyURLSearchParamsLike,
): string | null {
  if (!isOAuthFlow(params)) return null;
  return `${AUTHORIZE_PATH}?${params.toString()}`;
}

/** next/navigation の ReadonlyURLSearchParams を受けるための最小の形。 */
export type ReadonlyURLSearchParamsLike = {
  get(name: string): string | null;
  toString(): string;
};
