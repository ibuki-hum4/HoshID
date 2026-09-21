"use client";

import { Check, Copy, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

/**
 * 作成直後にだけ client_secret を見せる。
 * サーバはハッシュ化して保存するので、この画面を閉じると二度と取得できない。
 */
export function SecretReveal({
  clientId,
  clientSecret,
  onClose,
}: {
  clientId: string;
  clientSecret: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>アプリを作成しました</DialogTitle>
          <DialogDescription>
            アプリ側の設定に転記してください。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <CopyField label="Client ID" value={clientId} />

          {clientSecret ? (
            <>
              <CopyField label="Client Secret" value={clientSecret} />
              <div className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg p-3 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>
                  シークレットが表示されるのはこの一度きりです。閉じると再取得できません。
                </p>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              パブリッククライアントのためシークレットはありません。PKCE で保護されます。
            </p>
          )}
        </div>

        <DialogFooter>
          <Button  onClick={onClose}>
            控えました
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードが使えない環境では手で選択してもらう。
    }
  }

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <code className="bg-muted min-w-0 flex-1 truncate rounded-md px-3 py-2 font-mono text-sm">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-label={`${label} をコピー`}
          onClick={copy}
        >
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
        </Button>
      </div>
    </div>
  );
}
