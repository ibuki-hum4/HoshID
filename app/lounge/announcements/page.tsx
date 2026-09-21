import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ANNOUNCEMENT_LEVELS,
  announcementVariant,
  isAnnouncementLevel,
} from "@/lib/announcement";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";

export const metadata = { title: "お知らせ" };

export default async function AnnouncementsPage() {
  await requireApprovedUser();

  // 下書きは出さない。公開したものだけが全メンバーに見える。
  const announcements = await prisma.announcement.findMany({
    where: { published: true },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
  });

  return (
    <div className="space-y-8">
      <div>
        <h1>お知らせ</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          HoshID からの連絡です。
        </p>
      </div>

      {announcements.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>お知らせはありません</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => {
            const level = isAnnouncementLevel(announcement.level)
              ? announcement.level
              : "info";

            return (
              <Card key={announcement.id}>
                <CardHeader>
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
                        ? new Date(announcement.publishedAt).toLocaleDateString(
                            "ja-JP",
                          )
                        : null}
                    </span>
                  </div>
                  <CardTitle className="mt-1">{announcement.title}</CardTitle>
                </CardHeader>

                <CardContent>
                  {/*
                    Markdown として描画する。生の HTML は通さない
                    （components/markdown.tsx の説明を参照）。
                  */}
                  <Markdown>{announcement.body}</Markdown>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
