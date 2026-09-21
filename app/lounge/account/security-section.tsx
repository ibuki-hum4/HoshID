"use client";

import { MonitorSmartphone } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

import { revokeOtherSessions, revokeSession } from "./actions";

type SessionRow = {
  /** セッション ID。トークンは画面に渡さない。 */
  id: string;
  isCurrent: boolean;
  /** 読みやすく整形した端末名。 */
  device: string;
  /** 参考として折りたたみで出す生の UA。 */
  rawUserAgent: string | null;
  ipAddress: string;
  createdAt: string;
  expiresAt: string;
};

export function SecuritySection({ sessions }: { sessions: SessionRow[] }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  async function changePassword() {
    setMessage(null);

    if (next.length < 8) {
      setMessage({
        kind: "error",
        text: "新しいパスワードは8文字以上にしてください。",
      });
      return;
    }

    // 打ち間違えたまま変更すると、本人が締め出されて復旧手段が無くなる。
    if (next !== confirm) {
      setMessage({
        kind: "error",
        text: "新しいパスワードと確認用の入力が一致しません。",
      });
      return;
    }

    if (next === current) {
      setMessage({
        kind: "error",
        text: "現在と同じパスワードには変更できません。",
      });
      return;
    }

    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      // 他の端末のセッションも切る。パスワードを変える動機は多くの場合
      // 「乗っ取られたかもしれない」なので、切らないと変える意味が薄い。
      revokeOtherSessions: true,
    });

    if (error) {
      setMessage({ kind: "error", text: "現在のパスワードが正しくありません。" });
      return;
    }

    setCurrent("");
    setNext("");
    setConfirm("");
    setMessage({
      kind: "ok",
      text: "パスワードを変更し、他の端末からログアウトしました。",
    });
  }

  return (
    <div className="space-y-4">
      {message ? (
        <Alert variant={message.kind === "error" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">パスワードの変更</CardTitle>
          <CardDescription>
            変更すると、この端末以外のログインはすべて解除されます。
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="current-password">現在のパスワード</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-password">新しいパスワード</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">8文字以上。</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm-password">新しいパスワードの確認</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              aria-invalid={confirm.length > 0 && confirm !== next}
            />
            {confirm.length > 0 && confirm !== next ? (
              <p className="text-destructive text-xs">一致していません。</p>
            ) : null}
          </div>
        </CardContent>

        <CardFooter className="justify-end">
          <Button
            disabled={
              current.length === 0 || next.length === 0 || next !== confirm
            }
            onClick={changePassword}
          >
            変更する
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base font-medium">
                ログイン中の端末（{sessions.length}）
              </CardTitle>
              <CardDescription>
                心当たりのないものがあれば失効させてください。
              </CardDescription>
            </div>

            {sessions.length > 1 ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await revokeOtherSessions();
                    setMessage(
                      result.ok
                        ? { kind: "ok", text: "この端末以外をログアウトしました。" }
                        : { kind: "error", text: result.message },
                    );
                  })
                }
              >
                この端末以外をログアウト
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              表示できる情報がありません。
            </p>
          ) : null}

          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-muted/40 flex items-center gap-3 rounded-lg p-3"
            >
              <div className="bg-background flex size-9 shrink-0 items-center justify-center rounded-full">
                <MonitorSmartphone className="size-4" aria-hidden />
              </div>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{session.device}</span>
                  {session.isCurrent ? (
                    <Badge variant="secondary" className="shrink-0">
                      この端末
                    </Badge>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-xs">
                  {session.ipAddress} ·{" "}
                  {new Date(session.createdAt).toLocaleString("ja-JP")} にログイン
                </p>
                {session.rawUserAgent ? (
                  <details className="text-muted-foreground mt-1 text-xs">
                    <summary className="cursor-pointer">詳細</summary>
                    <p className="mt-1 break-all">{session.rawUserAgent}</p>
                    <p className="mt-0.5">
                      {new Date(session.expiresAt).toLocaleString("ja-JP")} まで有効
                    </p>
                  </details>
                ) : null}
              </div>

              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await revokeSession(session.id);
                    if (!result.ok) {
                      setMessage({ kind: "error", text: result.message });
                    }
                  })
                }
              >
                {session.isCurrent ? "ログアウト" : "失効"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
