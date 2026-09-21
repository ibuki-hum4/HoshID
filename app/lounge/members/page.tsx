import { ACCOUNT_STATUS } from "@/lib/account-status";
import { prisma } from "@/lib/prisma";
import { requireApprovedUser } from "@/lib/session";

import { MemberDirectory } from "./member-directory";

export const metadata = { title: "メンバー" };

export default async function MemberDirectoryPage() {
  await requireApprovedUser();

  // 名簿に出すのは利用中のアカウントだけ。審査待ち・却下・停止中の人を
  // 他のメンバーに見せる理由はなく、見せると審査状況が筒抜けになる。
  const members = await prisma.user.findMany({
    where: { status: ACCOUNT_STATUS.active },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      nickname: true,
      image: true,
      bio: true,
      createdAt: true,
    },
  });

  const links = await prisma.userLink.findMany({
    where: { userId: { in: members.map((member) => member.id) } },
    orderBy: { sortOrder: "asc" },
    select: { userId: true, kind: true, label: true, url: true },
  });

  const linksByUser = new Map<string, typeof links>();
  for (const link of links) {
    const current = linksByUser.get(link.userId) ?? [];
    current.push(link);
    linksByUser.set(link.userId, current);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1>メンバー</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          HoshID を使っている人たちです。
        </p>
      </div>

      <MemberDirectory
        members={members.map((member) => ({
          id: member.id,
          displayName: member.nickname || member.name,
          image: member.image,
          bio: member.bio,
          joinedAt: member.createdAt.toISOString(),
          links: (linksByUser.get(member.id) ?? []).map((link) => ({
            kind: link.kind,
            label: link.label,
            url: link.url,
          })),
        }))}
      />
    </div>
  );
}
