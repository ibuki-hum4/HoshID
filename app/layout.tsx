import type { Metadata } from "next";
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
    <html lang="ja">
      <body className="min-h-svh antialiased">{children}</body>
    </html>
  );
}
