"use client";

import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ACCOUNT_STATUS_DESCRIPTIONS,
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_VALUES,
  accountStatusVariant,
} from "@/lib/account-status";

/**
 * ステータスの意味を一覧で見せる i ボタン。
 *
 * Prepared / Archived / Suspended は語感から意味を推測しにくいので、
 * 画面のそばで説明を読めるようにしておく。
 */
export function StatusHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="ステータスの説明を見る"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Info className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 rounded-lg">
        <p className="mb-3 text-sm font-medium">ステータスの意味</p>

        <dl className="space-y-3">
          {ACCOUNT_STATUS_VALUES.map((status) => (
            <div key={status} className="flex gap-3">
              <dt className="shrink-0">
                <Badge
                  variant={accountStatusVariant(status)}
                >
                  {ACCOUNT_STATUS_LABELS[status]}
                </Badge>
              </dt>
              <dd className="text-muted-foreground text-xs">
                {ACCOUNT_STATUS_DESCRIPTIONS[status]}
              </dd>
            </div>
          ))}
        </dl>

        <p className="text-muted-foreground mt-3 border-t pt-3 text-xs">
          ログインできるのは <strong>Active</strong> のアカウントだけです。
        </p>
      </PopoverContent>
    </Popover>
  );
}
