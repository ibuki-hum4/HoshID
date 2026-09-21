import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import pkg from "@/package.json";
import { requireApprovedUser } from "@/lib/session";

import { AppearanceSettings } from "./appearance-settings";
import { StorageSettings } from "./storage-settings";
import { NotificationSettings } from "./notification-settings";

export const metadata = { title: "設定" };

const HELP_LINKS = [
  {
    href: "/help/guide",
    label: "使い方",
    description: "申請からログイン、他のサービスとの連携まで",
  },
  {
    href: "/help/glossary",
    label: "用語集",
    description: "パスキー、同意画面、連携アプリとは",
  },
  {
    href: "/help/faq",
    label: "よくある質問",
    description: "ログインできない、パスキーとは、など",
  },
  {
    href: "/help/report",
    label: "お問い合わせ・不具合報告",
    description: "運営に直接送れます",
  },
  {
    href: "/legal/terms",
    label: "利用規約",
    description: "アカウントの扱いと禁止事項",
  },
  {
    href: "/legal/privacy",
    label: "プライバシーポリシー",
    description: "保存しているデータと、外部に送られるもの",
  },
  {
    href: "/legal/licenses",
    label: "オープンソースライセンス",
    description: "利用しているパッケージの一覧",
  },
];

export default async function SettingsPage() {
  const user = await requireApprovedUser();
  const issuer = `${(process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "")}/api/auth`;

  return (
    <div className="space-y-8">
      <div>
        <h1>設定</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          アカウント以外の設定です。
        </p>
      </div>

      <section className="space-y-3">
        <h2>表示</h2>
        <AppearanceSettings />
      </section>

      <section className="space-y-3">
        <h2>通知</h2>
        <NotificationSettings enabled={user.notifyAnnouncements !== false} />
      </section>

      <section className="space-y-3">
        <h2>保存データ</h2>
        <StorageSettings />
      </section>

      <section className="space-y-3">
        <h2>ヘルプ</h2>
        <div className="glass-soft divide-y overflow-hidden rounded-lg border">
          {HELP_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:bg-accent/30 flex items-center justify-between gap-3 p-4 transition-colors"
            >
              <span>
                <span className="block text-sm font-medium">{link.label}</span>
                <span className="text-muted-foreground block text-xs">
                  {link.description}
                </span>
              </span>
              <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2>このアプリについて</h2>
        <Card>
          <CardHeader>
            <CardTitle>HoshID</CardTitle>
            <CardDescription>
              セルフホストの OpenID Connect プロバイダ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted-foreground">バージョン</dt>
              <dd className="font-mono">{pkg.version}</dd>
              <dt className="text-muted-foreground">issuer</dt>
              <dd className="font-mono break-all">{issuer}</dd>
            </dl>
            {/*
              「アップデートを確認」ボタンは置かない。自分でデプロイする
              Web アプリなので、更新は再デプロイで反映される。利用者が確認
              できる対象が存在しない。
            */}
            <p className="text-muted-foreground mt-3 text-xs">
              更新は運営者がデプロイした時点で反映されます。
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2>アカウント</h2>
        <Card>
          <CardHeader>
            <CardTitle>アカウントの設定はこちらではありません</CardTitle>
            <CardDescription>
              ニックネーム・アイコン・パスワード・パスキー・二段階認証・連携アプリは
              <Link
                href="/lounge/account"
                className="text-foreground mx-1 underline underline-offset-4"
              >
                アカウントセンター
              </Link>
              で変更します。
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </div>
  );
}
