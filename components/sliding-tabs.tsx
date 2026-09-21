"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

/**
 * 選択中の項目を示す丸い面が、滑って移動するタブ。
 *
 * Radix のタブは状態しか持たないので、選択中トリガーの位置と幅を測って
 * 背後の面を動かしている。CSS だけでは「隣の項目まで滑る」表現ができない。
 */

export const SlidingTabs = TabsPrimitive.Root;

export function SlidingTabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(
    null,
  );

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const active = list.querySelector<HTMLElement>('[data-state="active"]');
    if (!active) return;

    setIndicator({
      left: active.offsetLeft,
      width: active.offsetWidth,
    });
  }, []);

  // 初回と、子要素の状態が変わったときに測り直す。paint 前に測らないと
  // 最初の描画で面が左端から飛んでくる。
  useLayoutEffect(() => {
    measure();
  }, [measure, children]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    // data-state の変化（タブ切り替え）を拾う。
    const observer = new MutationObserver(measure);
    observer.observe(list, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });

    // 折り返しやフォント読み込みで位置がずれるため、寸法変化も見る。
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(list);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [measure]);

  return (
    <TabsPrimitive.List
      ref={listRef}
      className={cn(
        "relative flex w-full items-center gap-6 overflow-x-auto overflow-y-hidden border-b",
        className,
      )}
      {...props}
    >
      {indicator ? (
        <span
          aria-hidden
          className="bg-foreground pointer-events-none absolute bottom-0 h-0.5 transition-[left,width] duration-300 ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      ) : null}
      {children}
    </TabsPrimitive.List>
  );
}

export function SlidingTabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        // 下線は背後の span が担うので、トリガー自身には装飾を置かない。
        "text-muted-foreground data-[state=active]:text-foreground focus-visible:ring-ring relative z-10 rounded-sm px-1 py-3 text-sm whitespace-nowrap transition-colors data-[state=active]:font-medium focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function SlidingTabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      // 中身は動かさない。滑るのは選択中を示す面だけにする。
      className={cn("focus-visible:outline-none", className)}
      {...props}
    />
  );
}
