"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** ログアウト後の戻り先の補足文。登録フォームと編集ダイアログで揃える。 */
export const POST_LOGOUT_DESCRIPTION =
  "ログアウトを終えたあとに戻す先。アプリが送ってくる URL と完全に一致したときだけ戻ります（末尾のスラッシュやクエリが違うだけでも戻りません）。空欄なら HoshID のログアウト完了画面で止まります。";

/**
 * URI のリスト入力欄。登録フォームと編集ダイアログで共有する。
 * 既定はリダイレクト URI。ログアウト後の戻り先にも使う。
 */
export function RedirectUriFields({
  value,
  onChange,
  label = "リダイレクト URI",
  description = "認証後の戻り先。完全一致で照合されるため、末尾のスラッシュまで正確に。公開ホストは https のみ、http は localhost と 127.0.0.1 のみ使えます。",
  required = true,
}: {
  value: string[];
  onChange: (update: (current: string[]) => string[]) => void;
  label?: string;
  description?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label>
        {label}
        {required ? (
          <>
            {" "}
            <span className="text-destructive">*</span>
          </>
        ) : null}
      </Label>
      <p className="text-muted-foreground text-xs">{description}</p>

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
