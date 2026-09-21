import type { MetadataRoute } from "next";

/**
 * robots.txt。
 *
 * HoshID は Discord のサーバにいる人が申請してくる閉じた場所で、検索から
 * 見つかる必要が無い。
 *
 * **ただし「全部 Disallow」にはしない。** クロールを止めると、クローラは各
 * ページの `noindex` を読めなくなる。外部からリンクされていれば URL だけが
 * 検索結果に残り、しかもこちらから消させる手段が無くなる。**読ませたうえで
 * 「載せるな」と伝える方が確実に消える。**
 *
 * 一方、認証の経路（`/api`）とログインしないと見られない場所（`/lounge`）は
 * 読ませても意味が無いので、そこだけ止める。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/lounge/"],
    },
  };
}
