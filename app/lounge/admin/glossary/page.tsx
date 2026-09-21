import Link from "next/link";

import { Glossary, type GlossaryGroup } from "@/components/glossary";
import { SlidingLinkTabs } from "@/components/sliding-link-tabs";
import { requireApplicationPermission } from "@/lib/authorize";
import { JWKS_GRACE_PERIOD_SECONDS, JWKS_ROTATION_INTERVAL_SECONDS } from "@/lib/jwks";

export const metadata = { title: "管理者向け用語集" };

/**
 * 管理者・役員向けの用語集。
 *
 * 一般向け（/help/glossary）が「画面に出てくる言葉」を説明するのに対し、
 * こちらは**仕組みの側の言葉**を説明する。運用の判断に必要な範囲まで
 * 踏み込むが、実装の詳細は書かない（CLAUDE.md と docs/ の仕事）。
 */

const days = (seconds: number) => Math.round(seconds / 86_400);

const GROUPS: GlossaryGroup[] = [
  {
    title: "全体の仕組み",
    entries: [
      {
        term: "IdP",
        aka: "Identity Provider",
        description: (
          <>
            利用者が誰かを確かめ、その結果を他のサービスに伝える役目のことです。HoshID が
            これにあたります。HoshID は外部の IdP（Google など）には繋いでおらず、
            自分自身が身元の出どころになっています。
          </>
        ),
      },
      {
        term: "RP",
        aka: "Relying Party",
        description: (
          <>
            IdP の結果を頼りにするサービス、つまり「HoshID でログイン」を置く側の
            アプリのことです。管理画面では「アプリ」「クライアント」と呼んでいます。
          </>
        ),
      },
      {
        term: "OpenID Connect",
        aka: "OIDC",
        description: (
          <>
            「誰がログインしたか」を安全に伝えるための取り決めです。OAuth 2.0 の上に
            作られていて、HoshID はこれに沿って作られています。RP 側が対応していれば、
            HoshID 固有の実装を書かずに繋がります。
          </>
        ),
      },
      {
        term: "issuer",
        description: (
          <>
            この IdP を指す URL です。RP 側の設定に書く値で、
            <strong className="text-foreground font-medium">
              ここが1文字でも違うと繋がりません。
            </strong>
            HoshID の issuer は設定画面とトップページに表示されています。末尾のスラッシュ
            まで含めて正確に伝えてください。
          </>
        ),
      },
      {
        term: "Discovery",
        description: (
          <>
            issuer を伝えるだけで、RP が必要なエンドポイントを自動的に見つけられる仕組み
            です。対応している RP なら、URL を個別に設定する必要がありません。
          </>
        ),
      },
    ],
  },
  {
    title: "アプリの登録",
    entries: [
      {
        term: "クライアント",
        aka: "client",
        description: <>HoshID に登録されたアプリ1件のことです。RP と同じものを指します。</>,
      },
      {
        term: "client_id / client_secret",
        description: (
          <>
            アプリを識別する ID と、その持ち主であることを示す合言葉です。
            <strong className="text-foreground font-medium">
              client_secret は登録直後の一度しか表示されません。
            </strong>
            HoshID 側にはハッシュ化して保存しているため、後から見ることはできません。
            失った場合は登録し直しになります。
          </>
        ),
      },
      {
        term: "リダイレクト URI",
        description: (
          <>
            ログインが終わったあと、利用者を戻す先の URL です。
            <strong className="text-foreground font-medium">完全一致で照合します。</strong>
            末尾のスラッシュひとつ違うだけで拒否されます。前方一致を許すと、悪意ある
            相手が自分のサーバへ利用者を送り込めてしまうためです。
          </>
        ),
      },
      {
        term: "スコープ",
        description: (
          <>
            アプリが要求する情報の範囲です。同意画面に並ぶ項目に対応します。登録時に
            <strong className="text-foreground font-medium">必ず設定してください。</strong>
            空のまま登録すると、利用者がログインしようとした時点でエラーになります。
          </>
        ),
      },
      {
        term: "offline_access",
        description: (
          <>
            利用者がログインしていない間もアプリがアクセスを続けられるようにするスコープ
            です。これを要求したときだけリフレッシュトークンが発行されます。定期実行の
            バッチなどが必要とします。
          </>
        ),
      },
      {
        term: "検証済み",
        description: (
          <>
            管理者がアプリの実体を確かめた印です。HoshID では誰でもアプリを登録でき、
            名前も自由に付けられるため、この印だけが利用者にとっての判断材料になります。
          </>
        ),
      },
      {
        term: "動的クライアント登録",
        description: (
          <>
            アプリが API 経由で自分自身を登録する仕組みです。
            <strong className="text-foreground font-medium">
              HoshID では意図的に無効にしています。
            </strong>
            画面から登録できるため必要性が薄く、有効にすると認証なしでアプリを作られ、
            同意画面で偽の名前を名乗る足がかりになるためです。
          </>
        ),
      },
    ],
  },
  {
    title: "トークン",
    entries: [
      {
        term: "認可コードフロー",
        description: (
          <>
            ログインからトークン発行までの標準的な手順です。利用者のブラウザには短い
            引換券（認可コード）だけを渡し、実際のトークンはアプリのサーバが裏側で
            受け取ります。
            <strong className="text-foreground font-medium">
              コードは一度しか使えません。
            </strong>
          </>
        ),
      },
      {
        term: "PKCE",
        aka: "ピクシー",
        description: (
          <>
            認可コードを横取りされても使えないようにする仕組みです。HoshID では既定で
            必須ですが、まだ対応していないアプリのためにクライアントごとに外せます
            （合言葉を持つアプリに限る）。
            <strong className="text-foreground font-medium">
              外すのは、対応するまでの一時的な措置と考えてください。
            </strong>
          </>
        ),
      },
      {
        term: "ID トークン",
        description: (
          <>
            「誰がいつログインしたか」を HoshID が署名して渡す証明書です。アプリはこれを
            検証して利用者を特定します。有効期間は10時間です。
          </>
        ),
      },
      {
        term: "アクセストークン",
        description: (
          <>
            アプリが利用者の情報を取りに行くときに使う鍵です。有効期間は1時間です。
          </>
        ),
      },
      {
        term: "リフレッシュトークン",
        description: (
          <>
            アクセストークンを取り直すための引換券です。有効期間は30日で、
            <code className="font-mono text-xs">offline_access</code> を要求したアプリに
            だけ渡されます。
          </>
        ),
      },
      {
        term: "Device Code",
        aka: "RFC 8628",
        description: (
          <>
            文字を入力しづらい機器（テレビ、CLI など）のための手順です。機器に表示された
            短いコードを、利用者が別の端末のブラウザで入力して認証します。
          </>
        ),
      },
      {
        term: "Introspection / Revocation",
        description: (
          <>
            トークンがまだ有効かをアプリが問い合わせる仕組みと、トークンを無効にする
            仕組みです。どちらも公開しています。
          </>
        ),
      },
    ],
  },
  {
    title: "鍵",
    entries: [
      {
        term: "署名鍵",
        description: (
          <>
            トークンに署名するための鍵です。{days(JWKS_ROTATION_INTERVAL_SECONDS)}
            日ごとに自動で入れ替わります。運用者が定期的に操作する必要はありません。
          </>
        ),
      },
      {
        term: "JWKS",
        description: (
          <>
            署名を検証するための公開鍵を、RP が取りに来る場所です。公開鍵なので、
            誰でも見られて問題ありません。
          </>
        ),
      },
      {
        term: "kid",
        aka: "key id",
        description: (
          <>
            鍵1本を指す識別子です。トークンにはどの鍵で署名したかが kid として書かれて
            いて、RP はそれを見て JWKS から正しい公開鍵を選びます。
          </>
        ),
      },
      {
        term: "猶予期間",
        description: (
          <>
            署名をやめた鍵を、検証のために公開し続ける期間です（
            {days(JWKS_GRACE_PERIOD_SECONDS)}日）。この間に、その鍵で署名済みのトークンが
            寿命を迎えます。
            <strong className="text-foreground font-medium">
              ここを短くすると、まだ有効なトークンが突然弾かれます。
            </strong>
          </>
        ),
      },
      {
        term: "ルート秘密",
        aka: "BETTER_AUTH_SECRET",
        description: (
          <>
            署名鍵の秘密鍵、二要素認証の設定など、保存されている秘密すべてを暗号化して
            いる値です。
            <strong className="text-foreground font-medium">
              定期的に入れ替えるものではありません。
            </strong>
            失うか、手順を踏まずに差し替えると、二要素認証を設定している全員が
            締め出されます。
          </>
        ),
      },
    ],
  },
  {
    title: "権限と状態",
    entries: [
      {
        term: "admin",
        description: (
          <>
            最高権限です。ロールの変更、アカウントの削除、お知らせ、Webhook、監査ログ、
            署名鍵にアクセスできます。
          </>
        ),
      },
      {
        term: "officer",
        aka: "役員",
        description: (
          <>
            申請の審査とメンバー一覧の閲覧ができます。
            <strong className="text-foreground font-medium">
              ロール変更とアカウント削除はできません。
            </strong>
            「承認はしてほしいが、権限は配らせたくない」相手に渡す役割です。
          </>
        ),
      },
      {
        term: "Prepared / Active / Rejected / Archived / Suspended",
        description: (
          <>
            アカウントの状態です。
            <strong className="text-foreground font-medium">
              ログインできるのは Active だけ。
            </strong>
            Archived は使われなくなったもの、Suspended は規約違反などで止めたもので、
            どちらもログインできない点は同じです。分けてあるのは、後から理由が分かる
            ようにするためです。
          </>
        ),
      },
      {
        term: "監査ログ",
        description: (
          <>
            権限を使った操作の記録です。実行者と対象はその時点の名前を写して保存して
            いるため、アカウントが消えた後でも辿れます。Webhook の URL など、それ自体が
            鍵になる値は記録していません。
          </>
        ),
      },
    ],
  },
];

export default async function AdminGlossaryPage() {
  await requireApplicationPermission("list");

  return (
    <div className="space-y-8">
      <div>
        <h1>管理者向け用語集</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          仕組みの側の言葉です。画面に出てくる言葉は{" "}
          <Link href="/help/glossary" className="text-foreground underline underline-offset-4">
            一般向けの用語集
          </Link>{" "}
          にあります。
        </p>
      </div>

      <SlidingLinkTabs
        aria-label="手引き"
        items={[
          { href: "/lounge/admin/guide", label: "運用", active: false },
          { href: "/lounge/admin/glossary", label: "用語集", active: true },
        ]}
      />

      <Glossary groups={GROUPS} />
    </div>
  );
}
