/**
 * アイコン関連の定数。
 *
 * クライアントコンポーネントからも参照するため、sharp のような
 * サーバ専用の依存を持ち込まないよう `lib/avatar.ts` から切り出してある。
 * ここに画像処理を書かないこと。書くとブラウザ側のバンドルに sharp が
 * 混入してビルドが壊れる。
 */

/** 保存するアイコンの一辺。表示は縮小のみなのでこれで足りる。 */
export const AVATAR_SIZE = 256;

/** 受け付けるアップロードの上限。デコード前に必ず弾く。 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * アイコンの配信 URL。
 *
 * `version` を付けるのは、更新してもブラウザや RP が古い画像を掴み続ける
 * のを避けるため。URL が変わるので強いキャッシュを安全に効かせられる。
 */
export function avatarUrl(userId: string, version: string): string {
  return `/api/avatar/${userId}?v=${version}`;
}
