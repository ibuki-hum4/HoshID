"use client";

import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

import { setAnnouncementNotification } from "./actions";

export function NotificationSettings({ enabled }: { enabled: boolean }) {
  const [checked, setChecked] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    // 先に見た目を変え、失敗したら戻す。切り替えの手応えを待たせない。
    setChecked(next);
    setError(null);

    startTransition(async () => {
      const result = await setAnnouncementNotification(next);
      if (!result.ok) {
        setChecked(!next);
        setError(result.message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>お知らせをメールで受け取る</CardTitle>
        <CardDescription>
          管理者が「メールでも通知する」を選んで公開したお知らせが届きます。
          切っても、HoshID の画面ではお知らせを読めます。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">メールで受け取る</p>
          <Switch
            checked={checked}
            disabled={pending}
            onCheckedChange={toggle}
            aria-label="お知らせをメールで受け取る"
          />
        </div>

        <p className="text-muted-foreground text-xs">
          「重要」のお知らせと、アカウント申請の結果など本人に必ず伝える必要のある
          メールは、この設定に関わらず送られます。
        </p>
      </CardContent>
    </Card>
  );
}
