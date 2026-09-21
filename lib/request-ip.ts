import { findInvalidTrustedProxies } from "@better-auth/core/utils/ip";

/**
 * クライアント IP をどう特定するかの設定。
 *
 * **ここを設定し忘れると、プロキシの後ろでレート制限が壊れる。**
 *
 * Better Auth はクライアント IP を `x-forwarded-for` から取るが、このヘッダの
 * 左端は**クライアントが自分で詰められる**ので、そのまま信じられない。信頼
 * するプロキシを教えると、チェーンを右から辿って最初の信頼できないアドレスを
 * クライアントとみなす。教えないと、値がひとつだけのヘッダしか信用しない。
 *
 * Ingress は既定で `x-forwarded-for` に**追記**する（`$proxy_add_x_forwarded_for`）。
 * つまりクライアントが何か送ってくると値が2つ以上になり、信用されず IP は
 * 特定できない。その結果どうなるかというと——
 *
 *   - レート制限が**全員で1つのバケツ**になる（ログインは10秒3回が既定）。
 *     つまり同時に4人がログインしようとすると弾かれる
 *   - 監査ログに残る IP が当てにならなくなる
 *
 * ライブラリは警告を1回ログに出すだけなので、気づかないまま本番に出ると
 * 「たまにログインできない」という一番追いにくい形で現れる。
 *
 * 設定するのは**プロキシ自身のアドレス**。k8s なら Ingress コントローラの
 * Pod が属する CIDR を指す。「private な範囲だから」と 10.0.0.0/8 のような
 * 広い範囲を入れないこと。そこにクライアントが含まれると、詐称を信じることに
 * なって設定した意味が消える。
 */

/** `TRUSTED_PROXIES` を読む。カンマ区切りの IP か CIDR。 */
export function parseTrustedProxies(
  raw: string | undefined = process.env.TRUSTED_PROXIES,
): string[] | undefined {
  const entries = (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) return undefined;

  // **書き間違いで落とす。** Better Auth は不正な項目を警告して無視するが、
  // 無視された結果は「IP が特定できない」＝全員で1つのバケツであり、
  // 設定していないのと同じになる。静かに壊れるより起動を止める方がよい。
  const invalid = findInvalidTrustedProxies(entries);
  if (invalid.length > 0) {
    throw new Error(
      `TRUSTED_PROXIES に IP でも CIDR でもない値があります: ${invalid.join(", ")}`,
    );
  }

  return entries;
}

export const TRUSTED_PROXIES = parseTrustedProxies();
