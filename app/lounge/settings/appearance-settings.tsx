"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

import {
  REDUCE_MOTION_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "@/components/appearance-script";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Theme = "system" | "light" | "dark";

const THEMES: { value: Theme; label: string; icon: typeof Sun; hint: string }[] = [
  { value: "system", label: "自動", icon: Monitor, hint: "OS の設定に従う" },
  { value: "light", label: "ライト", icon: Sun, hint: "常に明るい配色" },
  { value: "dark", label: "ダーク", icon: Moon, hint: "常に暗い配色" },
];

/**
 * 表示に関する設定。
 *
 * 保存先はこのブラウザの localStorage。端末ごとに変えたい種類の設定なので、
 * アカウントには紐づけていない（職場は明るく、自宅は暗く、という使い方ができる）。
 *
 * 値の読み取りは useSyncExternalStore を使う。localStorage はサーバに存在せず、
 * effect で state を書くと描画後に一瞬だけ既定値が見えるため。
 */

/** localStorage の変更を購読する。他タブでの変更も拾う。 */
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(APPEARANCE_CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(APPEARANCE_CHANGED, onChange);
  };
}

/** 同じタブ内での変更を知らせるための、自前のイベント。 */
const APPEARANCE_CHANGED = "hoshid:appearance-changed";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // プライベートウィンドウなどで読めないことがある。
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // 保存できなくても、この場の見た目は変わる。
  }
  window.dispatchEvent(new Event(APPEARANCE_CHANGED));
}

export function AppearanceSettings() {
  const theme = useSyncExternalStore(
    subscribe,
    () => {
      const stored = read(THEME_STORAGE_KEY);
      return stored === "light" || stored === "dark" ? stored : "system";
    },
    // サーバ描画時は既定。描画前にインラインスクリプトが <html> へ
    // 反映しているので、見た目がちらつくことはない。
    () => "system" as const,
  );

  const reduceMotion = useSyncExternalStore(
    subscribe,
    () => read(REDUCE_MOTION_STORAGE_KEY) === "true",
    () => false,
  );

  const applyTheme = useCallback((next: Theme) => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (next !== "system") root.classList.add(next);
    write(THEME_STORAGE_KEY, next === "system" ? null : next);
  }, []);

  const applyReduceMotion = useCallback((next: boolean) => {
    document.documentElement.classList.toggle("reduce-motion", next);
    write(REDUCE_MOTION_STORAGE_KEY, String(next));
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>表示テーマ</CardTitle>
          <CardDescription>
            この端末のブラウザにだけ保存されます。ほかの端末には影響しません。
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div
            role="radiogroup"
            aria-label="表示テーマ"
            className="grid gap-3 sm:grid-cols-3"
          >
            {THEMES.map((option) => {
              const Icon = option.icon;
              const selected = theme === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => applyTheme(option.value)}
                  className={cn(
                    "focus-visible:ring-ring rounded-lg border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    selected
                      ? "border-foreground bg-accent/40"
                      : "hover:bg-accent/20",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  <p className="mt-2 text-sm font-medium">{option.label}</p>
                  <p className="text-muted-foreground text-xs">{option.hint}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>動きを減らす</CardTitle>
          <CardDescription>
            タブの切り替えなどの動きを止めます。OS 側で「視差効果を減らす」を
            設定している場合は、この設定に関わらず止まります。
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">アニメーションを無効にする</p>
            <Switch
              checked={reduceMotion}
              onCheckedChange={applyReduceMotion}
              aria-label="アニメーションを無効にする"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
