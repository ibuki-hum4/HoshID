import { SlidingLinkTabs, type LinkTabItem } from "@/components/sliding-link-tabs";
import {
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_VALUES,
  type AccountStatus,
} from "@/lib/account-status";

export function MemberFilter({
  current,
  total,
  counts,
  basePath = "/lounge/admin/members",
  allHref,
}: {
  current: AccountStatus | null;
  total: number;
  counts: Record<string, number>;
  basePath?: string;
  /**
   * 「すべて」の遷移先。申請の審査画面は `?status=` が無いときの既定が
   * 「審査待ち」なので、明示的に全件を表す URL を渡す必要がある。
   */
  allHref?: string;
}) {
  const items: LinkTabItem[] = [
    {
      href: allHref ?? basePath,
      label: "すべて",
      count: total,
      active: current === null,
    },
    ...ACCOUNT_STATUS_VALUES.map((status) => ({
      href: `${basePath}?status=${status}`,
      label: ACCOUNT_STATUS_LABELS[status],
      count: counts[status] ?? 0,
      active: current === status,
    })),
  ];

  return <SlidingLinkTabs items={items} aria-label="ステータスで絞り込む" />;
}
