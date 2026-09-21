import type { Metadata } from "next";

import { AppearanceScript } from "@/components/appearance-script";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "HoshID",
    template: "%s | HoshID",
  },
  description: "HoshID — OpenID Connect provider",
  // The sign-in and consent screens are part of an authorization flow and must
  // never be indexed or previewed by a crawler.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/* 描画前に表示設定を当てる。詳細は components/appearance-script.tsx */}
        <AppearanceScript />
      </head>
      <body className="flex min-h-svh flex-col antialiased">
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
