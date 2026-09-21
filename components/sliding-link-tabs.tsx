"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

export type LinkTabItem = {
  href: string;
  label: string;
  count?: number;
  active: boolean;
};

/**
 * リンクで切り替える版の、滑るタブ。
 *
 * 絞り込みはクエリパラメータで表すためリンクにしている。同じルート内の
 * 遷移ではこのコンポーネントが保たれるので、面は前の位置から滑って動く。
 */
export function SlidingLinkTabs({
  items,
  className,
  "aria-label": ariaLabel,
}: {
  items: LinkTabItem[];
  className?: string;
  "aria-label"?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(
    null,
  );

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const active = list.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) return;

    setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
  }, []);

  // paint 前に測らないと、最初の描画で面が左端から飛んでくる。
  useLayoutEffect(() => {
    measure();
  }, [measure, items]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    // 折り返しやフォント読み込みで位置がずれるため、寸法変化を見る。
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(list);
    return () => resizeObserver.disconnect();
  }, [measure]);

  return (
    <nav
      ref={listRef}
      aria-label={ariaLabel}
      className={cn(
        "relative flex w-full items-center gap-6 overflow-x-auto overflow-y-hidden border-b",
        className,
      )}
    >
      {indicator ? (
        <span
          aria-hidden
          className="bg-foreground pointer-events-none absolute bottom-0 h-0.5 transition-[left,width] duration-300 ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      ) : null}

      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "relative z-10 flex items-center gap-2 px-1 py-3 text-sm whitespace-nowrap transition-colors",
            item.active
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
          {item.count === undefined ? null : (
            <span className="text-muted-foreground text-xs tabular-nums">
              {item.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
