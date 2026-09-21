import Link from "next/link";

import pkg from "@/package.json";

const LINKS = [
  { href: "/help/guide", label: "使い方" },
  { href: "/help/faq", label: "よくある質問" },
  { href: "/help/report", label: "お問い合わせ・不具合報告" },
  { href: "/legal/terms", label: "利用規約" },
  { href: "/legal/privacy", label: "プライバシーポリシー" },
  { href: "/legal/licenses", label: "ライセンス" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="text-muted-foreground mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="補助リンク">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="hover:text-foreground underline-offset-4 transition-colors hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="text-xs">
          © {new Date().getFullYear()} HoshID
          <span className="mx-2">·</span>
          <span className="font-mono">v{pkg.version}</span>
        </p>
      </div>
    </footer>
  );
}
