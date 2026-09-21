"use client";

import { Check, ChevronDown, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { describeScope } from "@/lib/scopes";
import { cn } from "@/lib/utils";

/** クライアントに許可できるスコープ。openid は OIDC の前提なので外せない。 */
export const SELECTABLE_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
] as const;

const REQUIRED_SCOPE = "openid";

export function ScopePicker({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (scopes: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(scope: string) {
    if (scope === REQUIRED_SCOPE) return;
    onChange(
      value.includes(scope)
        ? value.filter((s) => s !== scope)
        : [...value, scope],
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className="border-input bg-background focus-visible:ring-ring flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
        >
          {value.map((scope) => (
            <Badge
              key={scope}
              variant="secondary"
              className="gap-1 rounded-full font-normal"
            >
              {scope}
              {scope === REQUIRED_SCOPE ? null : (
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`${scope} を外す`}
                  className="hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(scope);
                  }}
                >
                  <X className="size-3" aria-hidden />
                </span>
              )}
            </Badge>
          ))}

          <span className="text-muted-foreground flex-1 px-1">
            {value.length === 0 ? "スコープを選択" : ""}
          </span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-1">
        <ul>
          {SELECTABLE_SCOPES.map((scope) => {
            const selected = value.includes(scope);
            const locked = scope === REQUIRED_SCOPE;

            return (
              <li key={scope}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => toggle(scope)}
                  className={cn(
                    "hover:bg-accent flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm",
                    locked && "cursor-default opacity-70",
                  )}
                >
                  <Check
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      selected ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <span>
                    <span className="font-medium">{scope}</span>
                    {locked ? (
                      <span className="text-muted-foreground ml-2 text-xs">必須</span>
                    ) : null}
                    <span className="text-muted-foreground block text-xs">
                      {describeScope(scope).detail}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
