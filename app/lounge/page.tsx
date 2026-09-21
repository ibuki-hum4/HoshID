import Link from "next/link";
import { headers } from "next/headers";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ANNOUNCEMENT_LEVELS,
  announcementVariant,
  isAnnouncementLevel,
  toPlainExcerpt,
} from "@/lib/announcement";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReviewApplications, requireApprovedUser } from "@/lib/session";

export const metadata = { title: "ダッシュボード" };

export default async function LoungePage() {
  const user = await requireApprovedUser();
  const requestHeaders = await headers();

  const canReview = canReviewApplications(user.role);

  // 概要なので失敗しても画面全体は出す。
  const [consents, sessions, passkeyCount, preparedCount, announcements] =
    await Promise.all([
    auth.api.getOAuthConsents({ headers: requestHeaders }).catch(() => []),
    auth.api.listSessions({ headers: requestHeaders }).catch(() => []),
    prisma.passkey.count({ where: { userId: user.id } }).catch(() => 0),
    canReview
      ? prisma.user.count({ where: { status: "prepared" } }).catch(() => 0)
      : Promise.resolve(0),
    // 公開済みのみ。固定を先に、あとは新しい順。
    prisma.announcement
      .findMany({
        where: { published: true },
        orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
        take: 3,
      })
      .catch(() => []),
  ]);

  const displayName = user.nickname || user.name;

  // 02: 画面の主役を 1 つに決める。審査待ちが溜まっているならそれが最優先で、
  // 次にセキュリティ上の不足、どちらも無ければ通常の案内。
  const highlight =
    canReview && preparedCount > 0
      ? {
          title: `${preparedCount} 件の申請が承認を待っています`,
          body: "承認するとその人はログインできるようになり、通知メールが届きます。",
          action: { href: "/lounge/admin", label: "申請を確認する" },
        }
      : !user.twoFactorEnabled && passkeyCount === 0
        ? {
            title: "ログインがパスワードだけで守られています",
            body: "パスワードが漏れた時点で誰でも入れてしまいます。パスキーか二段階認証を足すと、パスワードを知られても入られません。",
            action: { href: "/lounge/account", label: "ログイン方法を追加する" },
          }
        : {
            title: `${displayName} さんのアカウントは保護されています`,
            body: "連携アプリと端末の状況は下のとおりです。身に覚えのないものがあれば解除してください。",
            action: { href: "/lounge/account", label: "アカウントを確認する" },
          };

  return (
    <div className="space-y-8">
      {/* 02: 主役。ここだけ大きく、ここだけ主要ボタンを置く。 */}
      <section>
        <h1>{highlight.title}</h1>
        <p className="text-muted-foreground mt-2 max-w-prose text-sm">
          {highlight.body}
        </p>
        <Button asChild className="mt-4">
          <Link href={highlight.action.href}>{highlight.action.label}</Link>
        </Button>
      </section>

      {/* 01/04: 装飾のアイコンは置かず、見出しと実数だけを出す。 */}
      <section className="space-y-3">
        <h2>いまの状態</h2>

        <dl className="grid gap-px overflow-hidden rounded-lg border sm:grid-cols-3">
          <Fact
            label="連携中のアプリ"
            value={consents.length}
            unit="件"
            href="/lounge/account"
          />
          <Fact
            label="ログイン中の端末"
            value={sessions.length}
            unit="台"
            href="/lounge/account"
          />
          <Fact
            label="登録したパスキー"
            value={passkeyCount}
            unit="個"
            href="/lounge/account"
          />
        </dl>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2>お知らせ</h2>
          {announcements.length > 0 ? (
            <Link
              href="/lounge/announcements"
              className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
            >
              すべて見る
            </Link>
          ) : null}
        </div>

        {announcements.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            いまのところお知らせはありません。
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border">
            {announcements.map((announcement) => {
              const level = isAnnouncementLevel(announcement.level)
                ? announcement.level
                : "info";

              return (
                <li key={announcement.id} className="glass-soft p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={announcementVariant(level)}
                      className="rounded-full"
                    >
                      {ANNOUNCEMENT_LEVELS[level]}
                    </Badge>
                    {announcement.pinned ? (
                      <Badge variant="outline" className="rounded-full">
                        固定
                      </Badge>
                    ) : null}
                    <span className="text-muted-foreground text-xs">
                      {announcement.publishedAt
                        ? new Date(announcement.publishedAt).toLocaleDateString("ja-JP")
                        : null}
                    </span>
                  </div>
                  <p className="mt-1 font-medium">{announcement.title}</p>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                    {toPlainExcerpt(announcement.body)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canReview && preparedCount === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>審査待ちの申請はありません</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/lounge/admin">過去の審査を見る</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Fact({
  label,
  value,
  unit,
  href,
}: {
  label: string;
  value: number;
  unit: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="glass-soft hover:bg-accent/40 block p-4 transition-colors"
    >
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums">
        {value}
        <span className="text-muted-foreground ml-1 text-sm font-normal">
          {unit}
        </span>
      </dd>
    </Link>
  );
}
