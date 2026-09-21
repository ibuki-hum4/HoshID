import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";

import { AnnouncementManager } from "./announcement-manager";

export const metadata = { title: "お知らせの管理" };

export default async function AdminAnnouncementsPage() {
  await requirePermission({ announcement: ["create"] });

  const announcements = await prisma.announcement.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  const authorIds = [
    ...new Set(
      announcements
        .map((announcement) => announcement.createdBy)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const authors = authorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true, nickname: true },
      })
    : [];
  const authorNames = new Map(
    authors.map((author) => [author.id, author.nickname ?? author.name]),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1>お知らせの管理</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          公開すると全メンバーのダッシュボードとお知らせ一覧に出ます。
        </p>
      </div>

      <AnnouncementManager
        announcements={announcements.map((announcement) => ({
          id: announcement.id,
          title: announcement.title,
          body: announcement.body,
          level: announcement.level,
          pinned: announcement.pinned,
          published: announcement.published,
          publishedAt: announcement.publishedAt?.toISOString() ?? null,
          createdAt: announcement.createdAt.toISOString(),
          authorName: announcement.createdBy
            ? (authorNames.get(announcement.createdBy) ?? "不明")
            : null,
        }))}
      />
    </div>
  );
}
