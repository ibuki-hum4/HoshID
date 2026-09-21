import Link from "next/link";

export const metadata = { title: "使い方" };

/**
 * 一般メンバー向けの使い方。
 *
 * **実装されている機能だけを書くこと。** ここに無いことを書くと、利用者は
 * 探しても見つからないものを探し続けることになる。機能を消したら、この
 * ページからも消すこと。
 */

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-foreground underline underline-offset-4">
      {children}
    </Link>
  );
}

export default function GuidePage() {
  return (
    <article className="space-y-10">
      <div>
        <h1>使い方</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          HoshID のアカウントを持ってから、対応するサービスにログインするまでの流れです。
          用語が分からないときは <A href="/help/glossary">用語集</A>、
          困ったときは <A href="/help/faq">よくある質問</A> をご覧ください。
        </p>
      </div>

      <section className="space-y-3">
        <h2>HoshID とは</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          HoshID は、ひとつのアカウントで複数のサービスにログインするための仕組みです。
          対応したサービスでは「HoshID でログイン」を選ぶだけで入れるようになり、
          サービスごとにパスワードを作って覚える必要がなくなります。
        </p>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          パスワードを預けるのは HoshID だけです。連携先のサービスにパスワードが
          渡ることはありません。
        </p>
      </section>

      <section className="space-y-3">
        <h2>1. アカウントを申請する</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          <strong className="text-foreground font-medium">
            HoshID は誰でも自由にアカウントを作れる仕組みではありません。
          </strong>
          <A href="/apply">アカウントを申請</A> から、メールアドレス・表示名・パスワードを
          登録すると申請になります。申請理由の入力は不要です。
        </p>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          申請すると、まず<strong className="text-foreground font-medium">確認用のメール</strong>
          が届きます。リンクを開いてメールアドレスを確認してください。
          <strong className="text-foreground font-medium">
            確認が済んでいないとログインできません。
          </strong>
        </p>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          確認が終わったら審査に進みます。管理者が承認すると、承認された旨のメールが届き、
          そこから使えるようになります。承認されなかった場合もお知らせします。
        </p>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          承認を待っている間にログインしようとすると、
          <strong className="text-foreground font-medium">まだご利用いただけません</strong>
          という画面が出ます。これは申請が届いていないという意味ではありません。
        </p>
      </section>

      <section className="space-y-3">
        <h2>2. ログインする</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          <A href="/sign-in">ログイン</A> では、次のどちらかを使います。
        </p>

        <ul className="glass-soft divide-y overflow-hidden rounded-lg border text-sm">
          <li className="p-4">
            <p className="font-medium">メールアドレスとパスワード</p>
            <p className="text-muted-foreground mt-1 leading-relaxed">
              申請のときに決めたものです。
            </p>
          </li>
          <li className="p-4">
            <p className="font-medium">パスキー</p>
            <p className="text-muted-foreground mt-1 leading-relaxed">
              端末の指紋・顔認証・PIN でログインします。あらかじめアカウントセンターで
              登録しておく必要があります。
            </p>
          </li>
        </ul>

        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          二段階認証を有効にしている場合は、続けて確認用のコードを入力します。
        </p>
      </section>

      <section className="space-y-3">
        <h2>3. 他のサービスにログインする</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          対応サービスで「HoshID でログイン」を選ぶと、HoshID の画面に移ります。
          まだログインしていなければログインを求められ、そのあと
          <strong className="text-foreground font-medium">同意画面</strong>
          が出ます。
        </p>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          同意画面では、そのサービスに何が渡るのかが項目ごとに書かれています。
          必要のない項目はチェックを外して許可できます（ただし、あなたを識別するための
          項目だけは外せません）。「許可」を押すと元のサービスに戻ります。
        </p>

        <div className="glass-soft space-y-2 rounded-lg border p-4">
          <p className="text-sm font-medium">同意画面で必ず見てほしいところ</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            アプリの名前は登録した人が自由に付けられます。管理者が実体を確かめたアプリだけが
            <strong className="text-foreground font-medium">検証済み</strong>
            と表示されます。
            <strong className="text-foreground font-medium">
              「検証していません」と出ているアプリに心当たりがない場合は、許可しないでください。
            </strong>
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2>4. アカウントを安全に保つ</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          ログイン後、<strong className="text-foreground font-medium">アカウントセンター</strong>
          のセキュリティから設定できます。
        </p>

        <ul className="glass-soft divide-y overflow-hidden rounded-lg border text-sm">
          <li className="p-4">
            <p className="font-medium">パスキーを登録する</p>
            <p className="text-muted-foreground mt-1 leading-relaxed">
              最も手軽で、かつ偽サイトに入力させられる被害（フィッシング）に強い方法です。
              複数の端末を登録できます。
            </p>
          </li>
          <li className="p-4">
            <p className="font-medium">二段階認証を有効にする</p>
            <p className="text-muted-foreground mt-1 leading-relaxed">
              認証アプリのコード、またはメールで届くコードを、パスワードに加えて求めます。
              有効にするとバックアップコードが表示されるので、
              <strong className="text-foreground font-medium">
                必ず手元に控えてください。
              </strong>
              端末を失くしたときに入る唯一の手段になります。
            </p>
          </li>
          <li className="p-4">
            <p className="font-medium">ログイン中の端末を確認する</p>
            <p className="text-muted-foreground mt-1 leading-relaxed">
              見覚えのない端末があれば、その場で失効させられます。あわせてパスワードを
              変更してください。変更すると他の端末はすべてログアウトされます。
            </p>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2>5. プロフィールと連携アプリ</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          アカウントセンターのプロフィールで、ニックネーム・アイコン・自己紹介・
          リンクを設定できます。ここで設定した内容は、
          <strong className="text-foreground font-medium">
            ログインしている他のメンバーが見られるメンバー名簿に表示されます。
          </strong>
          見られて困ることは書かないでください。
        </p>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          連携アプリのタブでは、これまでに許可したアプリを一覧できます。許可を取り消すと、
          そのアプリはあなたの情報を取得できなくなります。
        </p>
      </section>

      <section className="space-y-3">
        <h2>6. お知らせと設定</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          運営からのお知らせは、ログイン後のお知らせ画面に出ます。設定の通知から
          メールでの受信を切ることもできますが、
          <strong className="text-foreground font-medium">
            「重要」なお知らせは設定に関わらずメールでも届きます。
          </strong>
          重要と名乗りながら届かないのは筋が通らないためです。
        </p>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          設定では他に、配色（自動 / ライト / ダーク）と動きの量を選べます。この端末に
          保存された表示設定とブラウザのキャッシュを消すこともできます。消してもログアウト
          はされず、アカウントの情報も残ります。
        </p>
      </section>

      <section className="space-y-3">
        <h2>困ったときは</h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          まず <A href="/help/faq">よくある質問</A> を確認してください。解決しない場合は{" "}
          <A href="/help/report">お問い合わせ・不具合報告</A> からご連絡ください。
        </p>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          パスワードを忘れた場合は <A href="/forgot-password">パスワードの再設定</A> から
          やり直せます。登録したメールアドレスにリンクを送ります。
        </p>
      </section>
    </article>
  );
}
