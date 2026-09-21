import { ReportForm } from "./report-form";

export const metadata = { title: "お問い合わせ" };

export default function ReportPage() {
  return (
    <article className="space-y-6">
      <div>
        <h1>お問い合わせ</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          不具合の報告や質問を運営に送れます。ログインしていなくても送信できます。
        </p>
      </div>

      <ReportForm />
    </article>
  );
}
