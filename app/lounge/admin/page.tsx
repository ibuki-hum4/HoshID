import { StatusHelp } from "@/components/status-help";
import { ACCOUNT_STATUS, isAccountStatus } from "@/lib/account-status";
import { requireApplicationPermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";

import { ApplicationList } from "./application-list";
import { MemberFilter } from "./members/member-filter";

export const metadata = { title: "申請の審査" };

export default async function AdminPage(props: PageProps<"/lounge/admin">) {
  const reviewer = await requireApplicationPermission("list");

  const params = await props.searchParams;
  const requested = Array.isArray(params.status) ? params.status[0] : params.status;

  // 既定は「審査待ち」だが、`?status=` が無い場合と不正な場合を区別する。
  // すべて表示するときは status を null にして絞り込みを外す。
  const hasStatusParam = typeof requested === "string";
  const status = isAccountStatus(requested)
    ? requested
    : hasStatusParam
      ? null
      : ACCOUNT_STATUS.prepared;

  const applications = await prisma.user.findMany({
    where: status ? { status } : undefined,
    orderBy:
      status === ACCOUNT_STATUS.prepared
        ? { appliedAt: "asc" }
        : { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      status: true,
      appliedAt: true,
      reviewedAt: true,
      reviewedBy: true,
      reviewNote: true,
    },
  });

  // Discord を繋いでいるかどうか。件数ではなく有無だけが要るので、
  // 対象の申請者に絞って userId を集める。
  const discordLinks = await prisma.socialLink.findMany({
    where: {
      provider: "discord",
      userId: { in: applications.map((application) => application.id) },
    },
    select: { userId: true, inGuild: true },
  });

  const discordLinked = new Set(discordLinks.map((link) => link.userId));
  // 繋いだうちの1つでもサーバにいれば参加とみなす。
  const inGuild = new Set(
    discordLinks.filter((link) => link.inGuild).map((link) => link.userId),
  );

  // 審査者の表示名を引くため、必要な分だけまとめて取得する。
  const reviewerIds = [
    ...new Set(
      applications.map((a) => a.reviewedBy).filter((id): id is string => Boolean(id)),
    ),
  ];
  const reviewers = reviewerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: reviewerIds } },
        select: { id: true, name: true },
      })
    : [];
  const reviewerNames = new Map(reviewers.map((r) => [r.id, r.name]));

  const [total, counts] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const countByStatus = Object.fromEntries(
    counts.map((row) => [row.status, row._count._all]),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2">
          申請の審査
          <StatusHelp />
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          承認するとログインできるようになります。却下には理由が必要です。
        </p>
      </div>

      <MemberFilter
        current={status}
        total={total}
        counts={countByStatus}
        basePath="/lounge/admin"
        allHref="/lounge/admin?status=all"
      />

      <ApplicationList
        selfId={reviewer.id}
        applications={applications.map((application) => ({
          id: application.id,
          name: application.name,
          email: application.email,
          emailVerified: application.emailVerified,
          discordLinked: discordLinked.has(application.id),
          inGuild: inGuild.has(application.id),
          image: application.image,
          status: application.status,
          appliedAt: application.appliedAt?.toISOString() ?? null,
          reviewedAt: application.reviewedAt?.toISOString() ?? null,
          reviewerName: application.reviewedBy
            ? (reviewerNames.get(application.reviewedBy) ?? "不明")
            : null,
          reviewNote: application.reviewNote,
        }))}
      />
    </div>
  );
}
