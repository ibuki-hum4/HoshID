import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata = { title: "プライバシーポリシー" };

export default function PrivacyPage() {
  return (
    <article className="space-y-6">
      <h1>プライバシーポリシー</h1>

      <Alert variant="destructive">
        <AlertDescription>
          この文書はまだ整備されていません。公開運用を始める前に、運営者が内容を
          定めてください。下は HoshID が実際に扱っているデータの一覧で、文面を
          書く際の材料です。
        </AlertDescription>
      </Alert>

      <section className="space-y-3">
        <h2>HoshID が保存しているもの</h2>
        <div className="glass-soft overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 font-medium">データ</th>
                <th className="px-4 py-2 font-medium">用途</th>
              </tr>
            </thead>
            <tbody>
              {DATA.map((row) => (
                <tr key={row.label} className="border-t">
                  <td className="px-4 py-2">{row.label}</td>
                  <td className="text-muted-foreground px-4 py-2">{row.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2>外部に送られるもの</h2>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
          <li>メール（さくらのメールボックス経由）— 宛先と本文</li>
          <li>
            Discord / Slack の Webhook が設定されている場合 — 申請者の名前と
            メールアドレス
          </li>
          <li>
            連携したアプリ — 同意した範囲のプロフィール情報（許可は
            アカウントセンターから取り消せます）
          </li>
        </ul>
      </section>
    </article>
  );
}

const DATA = [
  { label: "メールアドレス・表示名", use: "ログインと本人への連絡" },
  { label: "パスワード（Argon2id のハッシュ）", use: "ログインの照合。元に戻せない形で保存" },
  { label: "パスキーの公開鍵", use: "パスキーによるログイン" },
  { label: "二段階認証の秘密鍵・バックアップコード", use: "二段階認証の照合" },
  { label: "ニックネーム・自己紹介・リンク・アイコン", use: "メンバー名簿での表示" },
  { label: "セッション（IP アドレス・User-Agent）", use: "ログイン状態の維持と、端末一覧の表示" },
  { label: "連携アプリへの同意記録", use: "同意画面の省略と、連携の解除" },
  { label: "申請と審査の記録（誰がいつ承認・却下したか）", use: "運用の追跡" },
];
