"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** リダイレクト URI の入力欄。登録フォームと編集ダイアログで共有する。 */
export function RedirectUriFields({
  value,
  onChange,
}: {
  value: string[];
  onChange: (update: (current: string[]) => string[]) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>
        リダイレクト URI <span className="text-destructive">*</span>
      </Label>
      <p className="text-muted-foreground text-xs">
        認証後の戻り先。完全一致で照合されるため、末尾のスラッシュまで正確に。
        公開ホストは https のみ、http は localhost と 127.0.0.1 のみ使えます。
      </p>

      {value.map((uri, index) => (
        <div key={index} className="flex gap-2">
          <Input
            value={uri}
            inputMode="url"
            placeholder="https://app.example.com/callback"
            onChange={(event) =>
              onChange((current) =>
                current.map((v, i) => (i === index ? event.target.value : v)),
              )
            }
          />
          {value.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label="この URI を削除"
              onClick={() =>
                onChange((current) => current.filter((_, i) => i !== index))
              }
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => onChange((current) => [...current, ""])}
      >
        <Plus className="size-4" aria-hidden />
        URI を追加
      </Button>
    </div>
  );
}
