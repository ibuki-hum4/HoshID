import { ExternalLink } from "lucide-react";

import licenses from "@/data/licenses.json";

export const metadata = { title: "オープンソースライセンス" };

export default function LicensesPage() {
  return (
    <article className="space-y-6">
      <h1>オープンソースライセンス</h1>

      <p className="text-muted-foreground text-sm">
        HoshID は以下のパッケージを利用しています。この一覧は `package.json` の
        直接の依存から機械的に生成しています（`bun run licenses:generate`）。
        推移的な依存は含みません。
      </p>

      <p className="text-muted-foreground text-xs">
        生成日時: {new Date(licenses.generatedAt).toLocaleString("ja-JP")} ·{" "}
        {licenses.entries.length} 件
      </p>

      <div className="glass-soft overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 font-medium">パッケージ</th>
              <th className="px-4 py-2 font-medium">バージョン</th>
              <th className="px-4 py-2 font-medium">ライセンス</th>
            </tr>
          </thead>
          <tbody>
            {licenses.entries.map((entry) => (
              <tr key={entry.name} className="border-t">
                <td className="px-4 py-2">
                  {entry.homepage ? (
                    <a
                      href={entry.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-4"
                    >
                      {entry.name}
                      <ExternalLink className="size-3 shrink-0" aria-hidden />
                    </a>
                  ) : (
                    entry.name
                  )}
                </td>
                <td className="text-muted-foreground px-4 py-2 font-mono text-xs">
                  {entry.version}
                </td>
                <td className="px-4 py-2">{entry.license}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
