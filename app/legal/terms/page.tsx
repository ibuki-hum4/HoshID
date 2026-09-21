import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata = { title: "利用規約" };

export default function TermsPage() {
  return (
    <article className="space-y-6">
      <h1>利用規約</h1>

      {/*
        文面は運営者が自分の言葉で書くべきもの。もっともらしい雛形を置くと、
        中身を確かめないまま運用に入ってしまう。未整備であることを隠さない。
      */}
      <Alert variant="destructive">
        <AlertDescription>
          この規約はまだ整備されていません。公開運用を始める前に、運営者が内容を
          定めてください。
        </AlertDescription>
      </Alert>

      <section className="space-y-3">
        <h2>定めるべき項目</h2>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
          <li>誰がアカウントを申請できるか、承認の基準</li>
          <li>アカウントを停止・削除する条件（Suspended / Archived の運用）</li>
          <li>登録した OAuth アプリに関する責任の所在</li>
          <li>禁止事項と、違反したときの扱い</li>
          <li>サービスの提供を終了する場合の告知方法</li>
          <li>準拠法と管轄</li>
        </ul>
      </section>
    </article>
  );
}
