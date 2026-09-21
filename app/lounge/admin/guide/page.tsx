import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { SlidingLinkTabs } from "@/components/sliding-link-tabs";
import { hasPermission, requireApplicationPermission } from "@/lib/authorize";

export const metadata = { title: "管理者の手引き" };

/**
 * 管理者・役員向けの運用の手引き。
 *
 * **画面でできることと、その判断基準を書く。** 実装の詳細は CLAUDE.md と
 * docs/ にあり、ここに写すと両方が古くなる。ここに書くのは「なぜその操作を
 * 慎重にやるのか」という、画面を見ただけでは分からないこと。
 */

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-foreground underline underline-offset-4">
      {children}
    </Link>
  );
}

function Caution({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-soft flex gap-3 rounded-lg border p-4">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="text-muted-foreground text-sm leading-relaxed">{children}</p>
    </div>
  );
}

export default async function AdminGuidePage() {
  // 役員も読む。管理者専用の内容はその旨を本文に書いて区別する。
  await requireApplicationPermission("list");
  const isAdmin = await hasPermission({ user: ["set-role"] });

  return (
    <div className="space-y-8">
      <div>
        <h1>管理者の手引き</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          管理画面でできることと、判断に迷ったときの基準です。
        </p>
      </div>

      <SlidingLinkTabs
        aria-label="手引き"
        items={[
          { href: "/lounge/admin/guide", label: "運用", active: true },
          { href: "/lounge/admin/glossary", label: "用語集", active: false },
        ]}
      />

      <section className="space-y-3">
        <h2>役割の分担</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          管理者向けの権限は2段階あります。
        </p>

        <dl className="glass-soft divide-y overflow-hidden rounded-lg border text-sm">
          <div className="p-4">
            <dt className="font-medium">役員（officer）</dt>
            <dd className="text-muted-foreground mt-1 leading-relaxed">
              申請の審査と、メンバー一覧の閲覧ができます。
              <strong className="text-foreground font-medium">
                ロールの変更とアカウントの削除はできません。
              </strong>
              「承認する権限」と「他人を管理者に昇格させる権限」を分けるための役割です。
            </dd>
          </div>
          <div className="p-4">
            <dt className="font-medium">管理者（admin）</dt>
            <dd className="text-muted-foreground mt-1 leading-relaxed">
              上記に加え、メンバーの編集・削除、お知らせの作成、Webhook の設定、
              監査ログと署名鍵の閲覧ができます。
            </dd>
          </div>
        </dl>

        {isAdmin ? null : (
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
            あなたは役員です。以下のうち管理者だけができる操作は、ナビゲーションにも
            表示されません。
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2>申請を審査する</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          <A href="/lounge/admin">申請の審査</A> に、承認待ちの申請が並びます。申請理由の
          申告は求めていないので、判断材料はメールアドレスと表示名、そして申請者が誰かを
          あなたが知っているかどうかです。
        </p>

        <ul className="glass-soft divide-y overflow-hidden rounded-lg border text-sm">
          <li className="p-4">
            <p className="font-medium">承認すると</p>
            <p className="text-muted-foreground mt-1 leading-relaxed">
              その場でログインできるようになり、承認メールが送られます。二重に押しても
              メールが2通飛ぶことはありません。
            </p>
          </li>
          <li className="p-4">
            <p className="font-medium">却下すると</p>
            <p className="text-muted-foreground mt-1 leading-relaxed">
              理由の入力が必須です。理由は本人に送るメールに載るので、本人が読む前提で
              書いてください。
            </p>
          </li>
        </ul>

        <Caution>
          メールの送信に失敗しても、承認そのものは取り消されません。画面に「承認したが
          メールを送れなかった」と出た場合は、本人に別の手段で伝えてください。
        </Caution>
      </section>

      <section className="space-y-3">
        <h2>メンバーを管理する</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          <A href="/lounge/admin/members">メンバー管理</A> で、ステータスとロールの変更、
          アカウントの削除ができます（管理者のみ）。
        </p>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          ログインできるのは <strong className="text-foreground font-medium">Active</strong>{" "}
          だけです。使われなくなったアカウントは Archived、規約違反などで止めるときは
          Suspended にします。どちらもログインできなくなる点は同じで、違いは
          <strong className="text-foreground font-medium">後から見たときに理由が分かること</strong>
          です。
        </p>

        <Caution>
          削除は取り消せません。そのメンバーが登録した OAuth アプリ、連携の許可、
          ログイン中の端末もすべて消えます。
          <strong className="text-foreground font-medium">
            止めたいだけなら Suspended を使ってください。
          </strong>
          なお、自分自身のロールとステータスは変更できず、管理者が0人になる変更と
          最後の管理者の削除も拒否されます。
        </Caution>
      </section>

      <section className="space-y-3">
        <h2>アプリを検証する</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          OAuth アプリの登録はメンバーなら誰でもできます。
          <strong className="text-foreground font-medium">
            アプリ名は登録者が自由に付けられる
          </strong>
          ため、同意画面では既存のサービスを騙ることもできてしまいます。
        </p>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          これを防ぐのが「検証済み」の印です。<A href="/lounge/apps">アプリ</A> から、
          管理者が実体を確かめたものにだけ付けます。
        </p>

        <Caution>
          <strong className="text-foreground font-medium">
            名前が正しそうだから、という理由で検証済みにしないでください。
          </strong>
          誰が運用しているアプリなのかを確かめてから付けます。この印は、利用者が
          「許可してよいか」を判断する唯一の手がかりです。
        </Caution>
      </section>

      <section className="space-y-3">
        <h2>お知らせを出す（管理者のみ）</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          <A href="/lounge/admin/announcements">お知らせ管理</A> から作成します。本文は
          Markdown で書けます。下書きのまま保存して、あとで公開に切り替えることもできます。
        </p>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          公開と同時にメールで送るかを選べます。
          <strong className="text-foreground font-medium">
            種別を「重要」にすると、本人がメール通知を切っていても送られます。
          </strong>
        </p>

        <Caution>
          「重要」を多用すると、受信設定が意味を失い、結果としてお知らせ全体が読まれなく
          なります。本当に全員に届く必要があるときだけ使ってください。
        </Caution>
      </section>

      <section className="space-y-3">
        <h2>通知先を設定する（管理者のみ）</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          <A href="/lounge/admin/webhooks">Webhook</A> で、申請や不具合報告を Discord や
          Slack に流せます。登録できるのは Discord と Slack の正規のホストだけです。
        </p>

        <Caution>
          <strong className="text-foreground font-medium">
            Webhook の URL はそれ自体が投稿の鍵です。
          </strong>
          知られるとそのチャンネルに誰でも投稿できてしまうので、画面のスクリーンショットを
          共有するときは隠してください。監査ログにも URL は記録していません。
        </Caution>
      </section>

      <section className="space-y-3">
        <h2>記録を確認する（管理者のみ）</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          <A href="/lounge/admin/audit">監査ログ</A> に、権限を使った操作が残ります。
          申請の承認・却下、メンバーの編集と削除、アプリの検証と削除、お知らせと
          Webhook の変更です。実行者と対象は
          <strong className="text-foreground font-medium">その時点の名前を写して</strong>
          保存しているので、アカウントが消えた後でも誰が何をしたか辿れます。
        </p>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          本人が自分のプロフィールやパスワードを変えた操作は残りません。量に埋もれて
          肝心な記録が見つからなくなるためです。
        </p>
      </section>

      <section className="space-y-3">
        <h2>署名鍵（管理者のみ）</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          <A href="/lounge/admin/keys">署名鍵</A> で状態を確認できます。
          <strong className="text-foreground font-medium">
            平常時にすることはありません。
          </strong>
          90日ごとに自動で入れ替わり、期限の設定や古い鍵の片付けはデプロイのたびに
          自動で行われます。
        </p>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          鍵の操作は画面からは行えません。取り返しのつかない操作を誤って押せる場所に
          置かないためです。手順は運営者向けの文書（
          <code className="font-mono text-xs">docs/key-rotation.md</code>）にあります。
        </p>
      </section>

      <section className="space-y-3">
        <h2>迷ったときの原則</h2>
        <ul className="glass-soft divide-y overflow-hidden rounded-lg border text-sm">
          {PRINCIPLES.map((principle) => (
            <li key={principle.title} className="p-4">
              <p className="font-medium">{principle.title}</p>
              <p className="text-muted-foreground mt-1 leading-relaxed">{principle.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const PRINCIPLES = [
  {
    title: "消すより止める",
    body: "削除は取り消せず、そのメンバーが作ったものも消えます。判断がつかないうちは Suspended か Archived で止めておけば、あとから戻せます。",
  },
  {
    title: "確かめてから印を付ける",
    body: "アプリの「検証済み」は、利用者が安全を判断する唯一の手がかりです。名前がそれらしいことは根拠になりません。",
  },
  {
    title: "却下の理由は本人が読む",
    body: "入力した理由はそのままメールで本人に届きます。内部向けのメモを書く欄ではありません。",
  },
  {
    title: "権限は最小限に配る",
    body: "審査だけを任せたい相手には役員を割り当てます。管理者はロール変更と削除ができるため、渡す相手を絞ってください。",
  },
];
