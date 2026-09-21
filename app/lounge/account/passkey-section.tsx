"use client";

import { Fingerprint, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export type PasskeyRow = {
  id: string;
  name: string | null;
  deviceType: string;
  backedUp: boolean;
  createdAt: string | null;
};

export function PasskeySection({ passkeys }: { passkeys: PasskeyRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  async function add() {
    setMessage(null);

    // ブラウザの認証器 UI が開く。ユーザーが閉じると error が返る。
    const result = await authClient.passkey.addPasskey({
      name: name.trim() || undefined,
    });

    if (result?.error) {
      setMessage({
        kind: "error",
        text: "登録できませんでした。ブラウザや端末が対応しているか確認してください。",
      });
      return;
    }

    setAdding(false);
    setName("");
    setMessage({ kind: "ok", text: "パスキーを登録しました。" });
    startTransition(() => router.refresh());
  }

  function remove(passkey: PasskeyRow) {
    setMessage(null);
    startTransition(async () => {
      const result = await authClient.passkey.deletePasskey({ id: passkey.id });
      if (result?.error) {
        setMessage({ kind: "error", text: "削除できませんでした。" });
        return;
      }
      setMessage({ kind: "ok", text: "パスキーを削除しました。" });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">パスキー</CardTitle>
        <CardDescription>
          端末の生体認証や PIN でログインできます。パスワードより安全で、
          フィッシングにも強い方式です。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {message ? (
          <Alert variant={message.kind === "error" ? "destructive" : "default"}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        ) : null}

        {passkeys.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            まだ登録されていません。
          </p>
        ) : null}

        {passkeys.map((passkey) => (
          <div
            key={passkey.id}
            className="bg-muted/40 flex items-center gap-3 rounded-lg p-3"
          >
            <div className="bg-background flex size-9 shrink-0 items-center justify-center rounded-full">
              <Fingerprint className="size-4" aria-hidden />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {passkey.name || "名前のないパスキー"}
              </p>
              <p className="text-muted-foreground text-xs">
                {passkey.deviceType === "singleDevice"
                  ? "この端末のみ"
                  : "複数端末で同期"}
                {passkey.createdAt
                  ? ` · ${new Date(passkey.createdAt).toLocaleDateString("ja-JP")} に登録`
                  : null}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`${passkey.name || "パスキー"} を削除`}
              disabled={pending}
              onClick={() => remove(passkey)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
      </CardContent>

      <CardFooter className="justify-end">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setAdding(true);
            setName("");
            setMessage(null);
          }}
        >
          <Plus className="size-4" aria-hidden />
          パスキーを追加
        </Button>
      </CardFooter>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>パスキーを追加</DialogTitle>
            <DialogDescription>
              続けるとブラウザの認証画面が開きます。端末の生体認証か PIN で確認してください。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="passkey-name">名前（任意）</Label>
            <Input
              id="passkey-name"
              value={name}
              maxLength={40}
              placeholder="例: 仕事用ノート PC"
              onChange={(event) => setName(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              複数登録したときに見分けるための名前です。
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAdding(false)}
            >
              やめる
            </Button>
            <Button  onClick={add}>
              続ける
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
