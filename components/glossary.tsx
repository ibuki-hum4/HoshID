import type { ReactNode } from "react";

/**
 * 用語集の見た目。一般向けと管理者向けの2か所で使う。
 *
 * 見出しと罫線だけで組む。用語ひとつずつをカードにすると、数が多いときに
 * 枠だらけになって逆に読めなくなる。
 */

export type GlossaryEntry = {
  term: string;
  /** 英語表記や別名。補助なので小さく添える。 */
  aka?: string;
  description: ReactNode;
};

export type GlossaryGroup = {
  title: string;
  entries: GlossaryEntry[];
};

/** 見出しから飛べるように id を振る。英数字以外は落とす。 */
function slug(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function Glossary({ groups }: { groups: GlossaryGroup[] }) {
  return (
    <div className="space-y-10">
      <nav aria-label="用語の分類" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {groups.map((group) => (
          <a
            key={group.title}
            href={`#${slug(group.title)}`}
            className="text-muted-foreground hover:text-foreground underline-offset-4 transition-colors hover:underline"
          >
            {group.title}
          </a>
        ))}
      </nav>

      {groups.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 id={slug(group.title)} className="scroll-mt-6">
            {group.title}
          </h2>

          <dl className="glass-soft divide-y overflow-hidden rounded-lg border">
            {group.entries.map((entry) => (
              <div key={entry.term} id={slug(entry.term)} className="scroll-mt-6 p-4">
                <dt className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
                  {entry.term}
                  {entry.aka ? (
                    <span className="text-muted-foreground font-mono text-xs font-normal">
                      {entry.aka}
                    </span>
                  ) : null}
                </dt>
                <dd className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {entry.description}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
