"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AppWindow,
  Inbox,
  LayoutDashboard,
  Megaphone,
  BookOpen,
  KeyRound,
  ScrollText,
  Settings,
  UserCog,
  UserRound,
  Users,
  Webhook,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useTilt } from "@/components/use-tilt";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

type NavSection = {
  /** 見出し。トップレベルの項目には付けない。 */
  title?: string;
  items: NavItem[];
};

const BASE_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/lounge", label: "ダッシュボード", icon: LayoutDashboard, exact: true },
      { href: "/lounge/account", label: "アカウントセンター", icon: UserRound },
      { href: "/lounge/announcements", label: "お知らせ", icon: Megaphone },
      { href: "/lounge/members", label: "メンバー", icon: Users },
      { href: "/lounge/settings", label: "設定", icon: Settings },
    ],
  },
  {
    title: "OAuth",
    items: [{ href: "/lounge/apps", label: "アプリ", icon: AppWindow }],
  },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/lounge/admin", label: "申請の審査", icon: Inbox, exact: true },
  { href: "/lounge/admin/members", label: "メンバー管理", icon: UserCog },
  { href: "/lounge/admin/announcements", label: "お知らせ管理", icon: Megaphone },
  { href: "/lounge/admin/webhooks", label: "Webhook", icon: Webhook },
  { href: "/lounge/admin/audit", label: "監査ログ", icon: ScrollText },
  { href: "/lounge/admin/keys", label: "署名鍵", icon: KeyRound },
  { href: "/lounge/admin/guide", label: "手引き", icon: BookOpen },
];

/**
 * 管理者向けの項目は権限ごとに要求が違う。役員は審査とメンバー管理までで、
 * お知らせ・Webhook・監査ログは持っていない。まとめて出すと、押した先が
 * 403 になる項目が並ぶ。どれを出すかはサーバ側で決めて `adminHrefs` で渡す。
 */
export function LoungeNav({ adminHrefs }: { adminHrefs: string[] }) {
  const pathname = usePathname();
  const tilt = useTilt();
  const adminItems = ADMIN_ITEMS.filter((item) => adminHrefs.includes(item.href));
  const sections =
    adminItems.length > 0
      ? [...BASE_SECTIONS, { title: "管理者のみ", items: adminItems }]
      : BASE_SECTIONS;

  return (
    <nav className="mb-6 md:mb-0 md:w-56 md:shrink-0">
      <div className="flex gap-4 overflow-x-auto md:flex-col md:gap-6 md:overflow-visible">
        {sections.map((section, index) => (
          <div key={section.title ?? index} className="min-w-0">
            {section.title ? (
              <p className="text-muted-foreground mb-1 hidden px-4 text-xs font-medium md:block">
                {section.title}
              </p>
            ) : null}

            <ul className="flex gap-1 md:flex-col">
              {section.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        // **現在地は下線、ホバーは塗り。** デジタル庁デザイン
                        // システムの水平メニューがこの分担で、カレントを
                        // 「色付きの文字＋下線」、ホバーを「背景の塗り」で
                        // 表している。役割が被らないので、ホバー中に現在地を
                        // 見失わない。
                        //
                        // 左端のアクセント罫線は使わない。項目の当たり判定と
                        // 見た目の範囲がずれ、横並びになる狭い画面では意味も失う。
                        "flex items-center gap-3 border-b-2 px-3 py-2 text-sm whitespace-nowrap",
                        // 傾きは指を離したら戻したいので transform も遷移させる。
                        // will-change は付けない（項目の数だけレイヤーが増える）。
                        "transition-[color,background-color,border-color,transform] duration-200",
                        active
                          ? "border-foreground text-foreground font-medium"
                          : "hover:bg-accent/60 text-muted-foreground hover:text-foreground border-transparent",
                      )}
                      {...tilt}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
