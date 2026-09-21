import Link from "next/link";

export const metadata = { title: "よくある質問" };

type Question = { q: string; a: React.ReactNode };

const SECTIONS: { title: string; items: Question[] }[] = [
  {
    title: "アカウント",
    items: [
      {
        q: "申請したのにログインできません",
        a: (
          <>
            アカウントは管理者が承認するまで使えません。承認されるとメールが届きます。
            しばらく待っても届かない場合は、迷惑メールフォルダを確認してください。
          </>
        ),
      },
      {
        q: "「まだご利用いただけません」と出ます",
        a: (
          <>
            承認待ちか、承認されなかったか、アカウントが停止されている状態です。
            心当たりがない場合は管理者にお問い合わせください。
          </>
        ),
      },
      {
        q: "パスワードを忘れました",
        a: (
          <>
            ログイン画面の
            <Link
              href="/forgot-password"
              className="text-foreground mx-1 underline underline-offset-4"
            >
              パスワードをお忘れですか
            </Link>
            から再設定できます。登録したメールアドレスにリンクを送ります。再設定すると、
            ログイン中の他の端末はすべてログアウトされます。
          </>
        ),
      },
      {
        q: "確認メールが届きません / 「メールアドレスがまだ確認されていません」と出ます",
        a: (
          <>
            申請したときに確認用のメールを送っています。リンクは1時間で切れますが、
            ログインを試みるたびに新しいリンクを送り直します。迷惑メールフォルダも
            確認してください。それでも届かない場合は管理者にお問い合わせください。
          </>
        ),
      },
    ],
  },
  {
    title: "ログイン",
    items: [
      {
        q: "パスキーとは何ですか",
        a: (
          <>
            端末の生体認証や PIN でログインする仕組みです。パスワードを覚える必要がなく、
            偽サイトに入力させられる被害（フィッシング）にも強いのが利点です。
            <Link
              href="/lounge/account"
              className="text-foreground mx-1 underline underline-offset-4"
            >
              アカウントセンター
            </Link>
            から登録できます。
          </>
        ),
      },
      {
        q: "認証アプリを無くしました",
        a: (
          <>
            二段階認証を有効にしたときに表示されたバックアップコードを使ってください。
            メールでコードを受け取る方法も選べます。どちらも使えない場合は管理者に
            お問い合わせください。
          </>
        ),
      },
      {
        q: "見覚えのない端末がログイン中です",
        a: (
          <>
            アカウントセンターのセキュリティから、その端末を失効させてください。
            あわせてパスワードを変更することをおすすめします。変更すると他の端末は
            すべてログアウトされます。
          </>
        ),
      },
    ],
  },
  {
    title: "アプリの連携",
    items: [
      {
        q: "同意画面に「検証していません」と出ます",
        a: (
          <>
            HoshID ではアプリを誰でも登録でき、アプリ名は登録者が自由に付けられます。
            管理者が実体を確かめたアプリだけが「検証済み」と表示されます。
            心当たりのないアプリには許可しないでください。
          </>
        ),
      },
      {
        q: "連携を解除したい",
        a: (
          <>
            アカウントセンターの「連携アプリ」から取り消せます。解除すると、そのアプリは
            あなたの情報を取得できなくなります。
          </>
        ),
      },
      {
        q: "自分のアプリを HoshID に繋ぎたい",
        a: (
          <>
            ラウンジの「アプリ」から登録できます。リダイレクト URI は完全一致で
            照合されるため、末尾のスラッシュまで正確に入力してください。
          </>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <article className="space-y-8">
      <div>
        <h1>よくある質問</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          操作の流れは
          <Link
            href="/help/guide"
            className="text-foreground mx-1 underline underline-offset-4"
          >
            使い方
          </Link>
          、言葉の意味は
          <Link
            href="/help/glossary"
            className="text-foreground mx-1 underline underline-offset-4"
          >
            用語集
          </Link>
          にあります。ここで解決しない場合は
          <Link
            href="/help/report"
            className="text-foreground mx-1 underline underline-offset-4"
          >
            お問い合わせ
          </Link>
          からご連絡ください。
        </p>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2>{section.title}</h2>

          <div className="glass-soft divide-y overflow-hidden rounded-lg border">
            {section.items.map((item) => (
              <details key={item.q} className="group">
                <summary className="hover:bg-accent/30 flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium transition-colors">
                  {item.q}
                  {/*
                    開閉の状態を記号で示す。閉じているときは ＋、開いている
                    ときは −。details の既定の三角は環境差が大きいので
                    list-none で消し、自前で出している。
                  */}
                  <span
                    aria-hidden
                    className="text-muted-foreground relative size-4 shrink-0"
                  >
                    <span className="bg-current absolute top-1/2 left-0 h-px w-4 -translate-y-1/2" />
                    <span className="bg-current absolute top-0 left-1/2 h-4 w-px -translate-x-1/2 transition-transform duration-200 group-open:scale-y-0" />
                  </span>
                </summary>
                <div className="text-muted-foreground px-4 pb-4 text-sm leading-relaxed">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
