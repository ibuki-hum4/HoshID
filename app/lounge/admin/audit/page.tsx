import { SlidingLinkTabs, type LinkTabItem } from "@/components/sliding-link-tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AUDIT_ACTIONS, isAuditAction } from "@/lib/audit";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "監査ログ" };

const PAGE_SIZE = 100;

/** 種別ごとにまとめて絞り込めるようにする。行為ひとつずつでは多すぎる。 */
const GROUPS = {
  application: { label: "申請", prefix: "application." },
  member: { label: "メンバー", prefix: "member." },
  client: { label: "アプリ", prefix: "client." },
  announcement: { label: "お知らせ", prefix: "announcement." },
  webhook: { label: "通知先", prefix: "webhook." },
} as const;

type Group = keyof typeof GROUPS;

function isGroup(value: unknown): value is Group {
  return typeof value === "string" && value in GROUPS;
}

export default async function AuditPage(props: PageProps<"/lounge/admin/audit">) {
  // 監査ログは「誰が権限を使ったか」の記録なので、閲覧も管理者に限る。
  await requirePermission({ user: ["set-role"] });

  const params = await props.searchParams;
  const requested = Array.isArray(params.group) ? params.group[0] : params.group;
  const group = isGroup(requested) ? requested : null;

  const where = group
    ? { action: { startsWith: GROUPS[group].prefix } }
    : undefined;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count(),
  ]);

  const counts = await Promise.all(
    (Object.keys(GROUPS) as Group[]).map(async (key) => [
      key,
      await prisma.auditLog.count({
        where: { action: { startsWith: GROUPS[key].prefix } },
      }),
    ]),
  );
  const countByGroup = Object.fromEntries(counts) as Record<Group, number>;

  const tabs: LinkTabItem[] = [
    {
      href: "/lounge/admin/audit",
      label: "すべて",
      count: total,
      active: group === null,
    },
    ...(Object.keys(GROUPS) as Group[]).map((key) => ({
      href: `/lounge/admin/audit?group=${key}`,
      label: GROUPS[key].label,
      count: countByGroup[key],
      active: group === key,
    })),
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1>監査ログ</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          権限を使った操作の記録です。新しい順に最大 {PAGE_SIZE} 件を表示します。
        </p>
      </div>

      <SlidingLinkTabs items={tabs} aria-label="種別で絞り込む" />

      <div className="glass-soft overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">日時</TableHead>
              <TableHead>操作</TableHead>
              <TableHead>対象</TableHead>
              <TableHead>実行者</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                  記録はまだありません。
                </TableCell>
              </TableRow>
            ) : null}

            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("ja-JP")}
                </TableCell>

                <TableCell className="text-sm">
                  {isAuditAction(log.action) ? AUDIT_ACTIONS[log.action] : log.action}
                </TableCell>

                <TableCell className="max-w-xs">
                  <p className="truncate text-sm">{log.targetLabel ?? "—"}</p>
                  {log.detail ? (
                    <p className="text-muted-foreground text-xs">{log.detail}</p>
                  ) : null}
                </TableCell>

                <TableCell className="max-w-xs">
                  <p className="truncate text-sm">{log.actorLabel}</p>
                  {log.ipAddress ? (
                    // 端末の文字列は長いので、出さずに title に持たせる。
                    <p
                      className="text-muted-foreground font-mono text-xs"
                      title={log.userAgent ?? undefined}
                    >
                      {log.ipAddress}
                    </p>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {total > PAGE_SIZE ? (
        <p className="text-muted-foreground text-xs">
          全 {total} 件のうち新しい {PAGE_SIZE} 件を表示しています。
        </p>
      ) : null}
    </div>
  );
}
