"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

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

/**
 * このブラウザに残っているデータを消す。
 *
 * 消すのは**この端末のブラウザに保存したものだけ**。アカウントの情報や
 * 連携アプリの許可は消えない。名前だけ見て「アカウントが消える」と
 * 誤解されないよう、何が消えるかを画面に並べる。
 *
 * ログイン状態（Cookie）には触らない。ここで巻き込むと、設定を消したいだけの
 * 人が突然ログアウトさせられる。
 */
export function StorageSettings() {
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function clear() {
    setPending(true);

    try {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // 読み書きできない環境では何もしない。
      }

      // 画像などのキャッシュ。Service Worker は使っていないが、将来
      // 追加されたときにもここで消えるようにしておく。
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }

      // 表示設定も消えたので、OS 設定の見た目に戻す。
      document.documentElement.classList.remove("light", "dark", "reduce-motion");

      setDone(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>このブラウザのデータを消す</CardTitle>
        <CardDescription>
          表示がおかしいときに試してください。アカウントの情報は消えません。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {done ? (
          <Alert>
            <AlertDescription>
              消去しました。表示テーマなどの設定は初期状態に戻っています。
            </AlertDescription>
          </Alert>
        ) : null}

        <div>
          <p className="text-sm font-medium">消えるもの</p>
          <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-5 text-sm">
            <li>表示テーマと「動きを減らす」の設定</li>
            <li>ブラウザが保持している画像などのキャッシュ</li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-medium">消えないもの</p>
          <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-5 text-sm">
            <li>ログイン状態（ログアウトされません）</li>
            <li>プロフィール・パスキー・二段階認証などアカウントの情報</li>
            <li>連携アプリへの許可</li>
          </ul>
        </div>
      </CardContent>

      <CardFooter className="justify-end">
        <Button variant="outline" disabled={pending} onClick={clear}>
          <Trash2 className="size-4" aria-hidden />
          {pending ? "消しています…" : "このブラウザのデータを消す"}
        </Button>
      </CardFooter>
    </Card>
  );
}
