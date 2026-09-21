"use client";

import { Plus, Send, Trash2, TriangleAlert } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WEBHOOK_KINDS } from "@/lib/webhook-kinds";

import {
  createWebhook,
  deleteWebhook,
  sendTestNotification,
  setWebhookEnabled,
} from "./actions";

const EVENTS = [
  { value: "application.submitted", label: "申請が届いたとき" },
  { value: "application.approved", label: "申請を承認したとき" },
  { value: "application.rejected", label: "申請を却下したとき" },
  { value: "report.submitted", label: "お問い合わせが届いたとき" },
] as const;

type WebhookRow = {
  id: string;
  kind: string;
  label: string;
  urlHost: string;
  events: string[];
  enabled: boolean;
  lastSentAt: string | null;
  lastError: string | null;
};

export function WebhookManager({ webhooks }: { webhooks: WebhookRow[] }) {
  const [kind, setKind] = useState<string>("discord");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["application.submitted"]);
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; message?: string }>, okText: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(
        result.ok
          ? { kind: "ok", text: okText }
          : { kind: "error", text: result.message ?? "失敗しました。" },
      );
    });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <Alert variant={message.kind === "error" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">通知先を追加</CardTitle>
          <CardDescription>
            Discord はチャンネル設定の「連携サービス」から Webhook URL を発行できます。
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <div className="grid gap-2">
              <Label htmlFor="webhook-kind">種別</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="webhook-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WEBHOOK_KINDS).map(([value, name]) => (
                    <SelectItem key={value} value={value}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="webhook-label">名前</Label>
              <Input
                id="webhook-label"
                value={label}
                maxLength={40}
                placeholder="例: 運営チャンネル"
                onChange={(event) => setLabel(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              value={url}
              inputMode="url"
              placeholder="https://discord.com/api/webhooks/..."
              onChange={(event) => setUrl(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              URL にはトークンが含まれます。登録後は一覧にホスト名までしか表示しません。
            </p>
          </div>

          <div className="grid gap-2">
            <Label>通知する出来事</Label>
            <ul className="space-y-2">
              {EVENTS.map((event) => (
                <li key={event.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`event-${event.value}`}
                    checked={events.includes(event.value)}
                    onCheckedChange={(checked) =>
                      setEvents((current) =>
                        checked === true
                          ? [...new Set([...current, event.value])]
                          : current.filter((value) => value !== event.value),
                      )
                    }
                  />
                  <label htmlFor={`event-${event.value}`} className="text-sm">
                    {event.label}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>

        <CardFooter className="justify-end">
          <Button
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await createWebhook({ kind, label, url, events });
                if (result.ok) {
                  setLabel("");
                  setUrl("");
                }
                return result;
              }, "通知先を追加しました。")
            }
          >
            <Plus className="size-4" aria-hidden />
            追加
          </Button>
        </CardFooter>
      </Card>

      <div className="glass-soft overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>通知先</TableHead>
              <TableHead>出来事</TableHead>
              <TableHead>最終送信</TableHead>
              <TableHead>有効</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {webhooks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                  通知先はまだありません。
                </TableCell>
              </TableRow>
            ) : null}

            {webhooks.map((webhook) => (
              <TableRow key={webhook.id}>
                <TableCell>
                  <p className="font-medium">{webhook.label}</p>
                  <p className="text-muted-foreground text-xs">
                    {WEBHOOK_KINDS[webhook.kind as keyof typeof WEBHOOK_KINDS] ??
                      webhook.kind}{" "}
                    · {webhook.urlHost}
                  </p>
                </TableCell>

                <TableCell>
                  <ul className="flex flex-wrap gap-1">
                    {webhook.events.map((event) => (
                      <li key={event}>
                        <Badge variant="outline" className="rounded-full text-xs">
                          {EVENTS.find((e) => e.value === event)?.label ?? event}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </TableCell>

                <TableCell className="text-xs">
                  {webhook.lastSentAt ? (
                    <>
                      <p className="text-muted-foreground">
                        {new Date(webhook.lastSentAt).toLocaleString("ja-JP")}
                      </p>
                      {webhook.lastError ? (
                        <p className="text-destructive mt-0.5 flex items-center gap-1">
                          <TriangleAlert className="size-3 shrink-0" aria-hidden />
                          {webhook.lastError}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell>
                  <Switch
                    checked={webhook.enabled}
                    disabled={pending}
                    aria-label={`${webhook.label} を有効にする`}
                    onCheckedChange={(checked) =>
                      run(
                        () => setWebhookEnabled(webhook.id, checked),
                        checked ? "有効にしました。" : "無効にしました。",
                      )
                    }
                  />
                </TableCell>

                <TableCell className="text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`${webhook.label} にテスト送信`}
                    disabled={pending || !webhook.enabled}
                    onClick={() =>
                      run(() => sendTestNotification(webhook.id), "テスト送信しました。")
                    }
                  >
                    <Send className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`${webhook.label} を削除`}
                    disabled={pending}
                    onClick={() =>
                      run(() => deleteWebhook(webhook.id), "削除しました。")
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
