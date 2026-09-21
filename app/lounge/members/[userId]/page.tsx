import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ACCOUNT_STATUS } from "@/lib/account-status";
import { ContributionGraph } from "@/components/contribution-graph";
import { LINK_KINDS, type LinkKind } from "@/lib/links";
import { getContributions } from "@/lib/social";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";

export async function generateMetadata(
  props: PageProps<"/lounge/members/[userId]">,
) {
  const { userId } = await props.params;
  const member = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, nickname: true, status: true },
  });

  if (!member || member.status !== ACCOUNT_STATUS.active) {
    return { title: "メンバー" };
  }
  return { title: member.nickname || member.name };
}

export default async function MemberProfilePage(
  props: PageProps<"/lounge/members/[userId]">,
) {
  const viewer = await requireApprovedUser();
  const { userId } = await props.params;

  const member = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      nickname: true,
      image: true,
      bio: true,
      status: true,
      createdAt: true,
    },
  });

  // 名簿に出していないアカウント（審査待ち・却下・停止中）は、個別ページでも
  // 存在を知らせない。ここで分けると、URL を総当たりして審査状況を
  // 調べられてしまう。
  if (!member || member.status !== ACCOUNT_STATUS.active) {
    notFound();
  }

  const links = await prisma.userLink.findMany({
    where: { userId: member.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, kind: true, label: true, url: true },
  });

  // 草は本人が「出す」と選んだときだけ取りに行く。既定では出さない。
  const [github, contributions] = await Promise.all([
    prisma.socialLink.findFirst({
      where: { userId: member.id, provider: "github", showContributions: true },
      select: { username: true, profileUrl: true },
    }),
    getContributions(member.id).catch(() => null),
  ]);

  const isSelf = member.id === viewer.id;
  const displayName = member.nickname || member.name;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/lounge/members">
            <ArrowLeft className="size-4" aria-hidden />
            メンバー一覧
          </Link>
        </Button>

        {isSelf ? (
          <Button asChild>
            <Link href="/lounge/account">
              <Pencil className="size-4" aria-hidden />
              プロフィール編集
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="size-20">
              {member.image ? <AvatarImage src={member.image} alt="" /> : null}
              <AvatarFallback className="text-2xl">
                {displayName.slice(0, 1)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <CardTitle className="flex flex-wrap items-center gap-2 text-2xl">
                {displayName}
                {isSelf ? (
                  <Badge variant="secondary">
                    あなた
                  </Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
                {new Date(member.createdAt).toLocaleDateString("ja-JP")} に参加
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <section>
            <h2 className="text-muted-foreground mb-1 text-xs font-medium">
              自己紹介
            </h2>
            {member.bio ? (
              <p className="text-sm whitespace-pre-wrap">{member.bio}</p>
            ) : (
              <p className="text-muted-foreground text-sm">
                {isSelf
                  ? "まだ書かれていません。プロフィール編集から追加できます。"
                  : "まだ書かれていません。"}
              </p>
            )}
          </section>

          <section>
            <h2 className="text-muted-foreground mb-2 text-xs font-medium">リンク</h2>
            {links.length === 0 ? (
              <p className="text-muted-foreground text-sm">ありません。</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {links.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      // 他人が入力した URL なので、参照元とタブの乗っ取りを
                      // 防ぐために必ず付ける。
                      rel="noopener noreferrer nofollow ugc"
                      className="inline-flex"
                    >
                      <Badge
                        variant="outline"
                        className="gap-1.5 rounded-full py-1.5 font-normal"
                      >
                        <span className="text-muted-foreground">
                          {LINK_KINDS[link.kind as LinkKind] ?? "リンク"}
                        </span>
                        <span className="max-w-48 truncate">{link.label}</span>
                        <ExternalLink className="size-3 shrink-0" aria-hidden />
                      </Badge>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {github && contributions ? (
            <section>
              <h2 className="text-muted-foreground mb-2 text-xs font-medium">
                GitHub
              </h2>
              <a
                href={github.profileUrl ?? `https://github.com/${github.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline underline-offset-4"
              >
                @{github.username}
              </a>
              <div className="mt-3">
                <ContributionGraph
                  contributions={contributions}
                  username={github.username}
                />
              </div>
            </section>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
