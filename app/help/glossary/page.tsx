import Link from "next/link";

import { Glossary, type GlossaryGroup } from "@/components/glossary";
import {
  ACCOUNT_STATUS_DESCRIPTIONS,
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_VALUES,
} from "@/lib/account-status";
import { SCOPE_DESCRIPTIONS } from "@/lib/scopes";

export const metadata = { title: "用語集" };

/**
 * 一般メンバー向けの用語集。
 *
 * **技術用語をそのまま説明しない。** 「OIDC とは」ではなく「その言葉が画面の
 * どこに出てきて、自分に何の関係があるか」を書く。踏み込んだ説明が要る人は
 * 管理者向けの用語集（/lounge/admin/glossary）を読む。
 *
 * ステータスとスコープの説明は、画面に出ているものと食い違わないよう
 * `lib/account-status.ts` と `lib/scopes.ts` から引いている。
 */

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-foreground underline underline-offset-4">
      {children}
    </Link>
  );
}

const GROUPS: GlossaryGroup[] = [
  {
    title: "アカウント",
    entries: [
      {
        term: "申請",
        description: (
          <>
            HoshID でのアカウント作成のことです。登録した時点ではまだ使えず、管理者が
            承認して初めてログインできるようになります。一般的なサービスの「新規登録」と
            違い、その場で使い始めることはできません。
          </>
        ),
      },
      {
        term: "承認",
        description: <>管理者が申請を確かめて、利用を許可することです。承認されるとメールが届きます。</>,
      },
      {
        term: "ステータス",
        description: (
          <>
            アカウントがいまどの段階にあるかを表す状態です。
            <dl className="mt-2 space-y-1">
              {ACCOUNT_STATUS_VALUES.map((status) => (
                <div key={status} className="flex gap-2">
                  <dt className="text-foreground w-24 shrink-0 font-medium">
                    {ACCOUNT_STATUS_LABELS[status]}
                  </dt>
                  <dd>{ACCOUNT_STATUS_DESCRIPTIONS[status]}</dd>
                </div>
              ))}
            </dl>
          </>
        ),
      },
      {
        term: "メールアドレスの確認",
        description: (
          <>
            申請したアドレスが本当にあなたのものか確かめる手順です。申請の直後に届く
            メールのリンクを開くと完了します。
            <strong className="text-foreground font-medium">
              確認が済むまでログインできません。
            </strong>
            他人のアドレスで申請されたアカウントが、そのアドレスを名乗って他の
            サービスに入るのを防ぐためです。
          </>
        ),
      },
      {
        term: "パスワードの再設定",
        description: (
          <>
            ログイン画面から要求すると、登録したアドレスにリンクが届きます。リンクは
            1時間で切れます。再設定すると
            <strong className="text-foreground font-medium">
              ログイン中の他の端末はすべてログアウトされます。
            </strong>
          </>
        ),
      },
      {
        term: "ニックネーム",
        description: (
          <>
            表示名とは別に設定できる呼び名です。設定するとメンバー名簿や画面上部で
            そちらが使われます。
          </>
        ),
      },
    ],
  },
  {
    title: "ログイン",
    entries: [
      {
        term: "パスキー",
        aka: "passkey",
        description: (
          <>
            端末の指紋・顔認証・PIN でログインする仕組みです。覚えるパスワードがなく、
            偽サイトに入力させられる被害にも強いのが利点です。端末ごとに登録します。
          </>
        ),
      },
      {
        term: "二段階認証",
        aka: "2FA",
        description: (
          <>
            パスワードに加えて、もうひとつの確認を求める設定です。パスワードが漏れただけでは
            入られなくなります。HoshID では認証アプリのコードとメールのコードが使えます。
          </>
        ),
      },
      {
        term: "認証アプリ",
        aka: "TOTP",
        description: (
          <>
            30秒ごとに新しい数字を表示するアプリです。HoshID で二段階認証を有効にするとき
            QR コードを読み取って登録します。
          </>
        ),
      },
      {
        term: "バックアップコード",
        description: (
          <>
            二段階認証を有効にしたときに表示される、使い捨ての予備コードです。
            <strong className="text-foreground font-medium">
              認証アプリを入れた端末を失くしたときに入る唯一の手段
            </strong>
            なので、必ず手元に控えてください。一度使ったコードは使えなくなります。
          </>
        ),
      },
      {
        term: "セッション",
        description: (
          <>
            ログインしている状態のことです。端末やブラウザごとに作られます。アカウント
            センターで一覧でき、見覚えのないものは失効させられます。
          </>
        ),
      },
    ],
  },
  {
    title: "他のサービスとの連携",
    entries: [
      {
        term: "連携",
        description: (
          <>
            他のサービスに HoshID のアカウントでログインすることです。連携しても、その
            サービスにパスワードは渡りません。
          </>
        ),
      },
      {
        term: "同意画面",
        description: (
          <>
            連携するときに出る、「このアプリに何を渡すか」を確認する画面です。ここで許可した
            ものだけが相手に渡ります。
          </>
        ),
      },
      {
        term: "権限",
        aka: "スコープ",
        description: (
          <>
            同意画面に並ぶ項目のことです。HoshID で使われるのは次のものです。
            <dl className="mt-2 space-y-1">
              {Object.entries(SCOPE_DESCRIPTIONS).map(([scope, description]) => (
                <div key={scope} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                  <dt className="text-foreground shrink-0 font-medium sm:w-40">
                    {description.title}
                    {description.required ? "（外せません）" : ""}
                  </dt>
                  <dd>{description.detail}</dd>
                </div>
              ))}
            </dl>
          </>
        ),
      },
      {
        term: "検証済み",
        description: (
          <>
            管理者がそのアプリの実体を確かめた、という印です。
            <strong className="text-foreground font-medium">
              アプリの名前は登録した人が自由に付けられる
            </strong>
            ため、名前だけでは信用できません。「検証していません」と出ているアプリに
            心当たりがなければ、許可しないでください。
          </>
        ),
      },
      {
        term: "連携アプリ",
        description: (
          <>
            あなたが許可したアプリの一覧です。アカウントセンターから、いつでも許可を
            取り消せます。
          </>
        ),
      },
    ],
  },
  {
    title: "お知らせ",
    entries: [
      {
        term: "重要なお知らせ",
        description: (
          <>
            設定でメール通知を切っていても届くお知らせです。重要と名乗りながら届かないのは
            筋が通らないため、この種別だけは受信設定より優先します。
          </>
        ),
      },
    ],
  },
];

export default function GlossaryPage() {
  return (
    <article className="space-y-8">
      <div>
        <h1>用語集</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          HoshID の画面に出てくる言葉の説明です。操作の流れは{" "}
          <A href="/help/guide">使い方</A>、困ったときは{" "}
          <A href="/help/faq">よくある質問</A> をご覧ください。
        </p>
      </div>

      <Glossary groups={GROUPS} />
    </article>
  );
}
