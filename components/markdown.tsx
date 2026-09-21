import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * お知らせの本文を Markdown として描画する。
 *
 * **生の HTML は通さない。** react-markdown は既定で HTML を描画せず、
 * ここでも `rehype-raw` のような HTML を復活させるプラグインは入れていない。
 * 入れてはいけない。お知らせは全メンバーの画面に出るため、管理者アカウントが
 * 乗っ取られた時に任意のスクリプトを全員に配ることになる。
 *
 * 併せて、描画してよい要素を明示的に絞っている。将来 Markdown の仕様が
 * 広がっても、意図しない要素が勝手に増えない。
 */

const ALLOWED_ELEMENTS = [
  "p",
  "br",
  "strong",
  "em",
  "del",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-sm leading-relaxed",
        // 見出しは本文より少しだけ強く。お知らせの中で階層を作りすぎない。
        "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold",
        "[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold",
        "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5",
        "[&_a]:underline [&_a]:underline-offset-4",
        "[&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
        "[&_pre]:bg-muted [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-3",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_blockquote]:border-border [&_blockquote]:text-muted-foreground [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3",
        "[&_hr]:border-border [&_hr]:my-4",
        "[&_table]:my-2 [&_table]:w-full [&_table]:text-left",
        "[&_th]:border-b [&_th]:py-1 [&_th]:pr-3 [&_th]:font-medium",
        "[&_td]:border-b [&_td]:py-1 [&_td]:pr-3",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={ALLOWED_ELEMENTS}
        // 許可していない要素は、中身のテキストだけを残して要素を捨てる。
        unwrapDisallowed
        components={{
          a: ({ href, children: linkChildren }) => (
            <a
              href={sanitizeHref(href)}
              target="_blank"
              // 本文を書くのは管理者だが、リンク先は外部サイト。参照元と
              // タブの乗っ取りを防ぐために付ける。
              rel="noopener noreferrer"
            >
              {linkChildren}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/**
 * リンク先を http / https に限定する。
 *
 * `javascript:` を許すと、リンクを踏んだ人のブラウザで任意のスクリプトが
 * 走る。react-markdown も既定で弾くが、ここでも明示的に確認しておく。
 */
function sanitizeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;

  try {
    const url = new URL(href, "https://example.invalid");
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return href;
  } catch {
    return undefined;
  }
}
