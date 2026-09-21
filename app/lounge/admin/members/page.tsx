import { StatusHelp } from "@/components/status-help";
import { isAccountStatus } from "@/lib/account-status";
import { requireMemberListPermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";

import { MemberFilter } from "./member-filter";
import { MemberGrid } from "./member-grid";

export const metadata = { title: "メンバー" };

export default async function MembersPage(
  props: PageProps<"/lounge/admin/members">,
) {
  const actor = await requireMemberListPermission();

  const params = await props.searchParams;
  const requested = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = isAccountStatus(requested) ? requested : null;

  const [members, counts, total] = await Promise.all([
    prisma.user.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        image: true,
        role: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.count(),
  ]);

  const countByStatus = Object.fromEntries(
    counts.map((row) => [row.status, row._count._all]),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2">
          メンバー
          <StatusHelp />
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          登録されているアカウントの一覧です。ステータスとロールを変更できます。
        </p>
      </div>

      <MemberFilter current={status} total={total} counts={countByStatus} />

      <MemberGrid
        selfId={actor.id}
        members={members.map((member) => ({
          id: member.id,
          name: member.name,
          nickname: member.nickname,
          email: member.email,
          image: member.image,
          role: member.role ?? "user",
          status: member.status,
          createdAt: member.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
