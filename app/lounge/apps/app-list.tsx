"use client";

import { AppWindow, BadgeCheck, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Switch } from "@/components/ui/switch";
import { parseScopes } from "@/lib/scopes";

import { deleteApp, setClientVerified } from "./actions";

type AppRow = {
  clientId: string;
  clientName: string | null;
  redirectUris: string[];
  scope: string;
  isPublic: boolean;
  requirePkce: boolean;
  disabled: boolean;
  /** 管理者向けの一覧でのみ入る所有者名。 */
  owner: string | null;
  /** 管理者向けの一覧でのみ入る検証状態。自分のアプリ一覧では null。 */
  verified: boolean | null;
};

export function AppList({
  clients,
  title,
  description,
  emptyMessage,
  deletable = true,
}: {
  clients: AppRow[];
  title: string;
  description?: string;
  emptyMessage: string;
  deletable?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AppRow | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {clients.length === 0 ? (
        <Card>
          <CardHeader>
            <CardDescription>{emptyMessage}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {clients.map((client) => (
        <Card key={client.clientId}>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-full">
                <AppWindow className="size-5" aria-hidden />
              </div>

              <div className="min-w-0 flex-1">
                <CardTitle className="text-base font-medium">
                  {client.clientName ?? "(名前なし)"}
                </CardTitle>
                <CardDescription className="font-mono text-xs break-all">
                  {client.clientId}
                </CardDescription>
                {client.owner ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    所有者: {client.owner}
                  </p>
                ) : null}
              </div>

              {deletable ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label="このアプリを削除"
                  disabled={pending}
                  onClick={() => setDeleting(client)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {client.isPublic ? "パブリック" : "コンフィデンシャル"}
              </Badge>
              {client.disabled ? (
                <Badge variant="destructive">
                  無効
                </Badge>
              ) : null}
              {client.verified ? (
                <Badge variant="default" className="gap-1 rounded-full">
                  <BadgeCheck className="size-3" aria-hidden />
                  検証済み
                </Badge>
              ) : null}
              {client.requirePkce ? null : (
                <Badge variant="destructive">
                  PKCE 無効
                </Badge>
              )}
              {parseScopes(client.scope).map((scope) => (
                <Badge key={scope} variant="outline">
                  {scope}
                </Badge>
              ))}
            </div>

            {client.verified !== null ? (
              <div className="flex items-center gap-2">
                <Switch
                  id={`verify-${client.clientId}`}
                  checked={client.verified}
                  disabled={pending}
                  onCheckedChange={(checked) =>
                    startTransition(async () => {
                      const result = await setClientVerified(client.clientId, checked);
                      if (!result.ok) setError(result.message);
                    })
                  }
                />
                <label htmlFor={`verify-${client.clientId}`} className="text-sm">
                  検証済みにする
                  <span className="text-muted-foreground block text-xs">
                    同意画面の警告が消え、バッジが付きます。実体を確かめてから。
                  </span>
                </label>
              </div>
            ) : null}

            <div>
              <p className="text-muted-foreground text-xs">リダイレクト URI</p>
              <ul className="mt-1 space-y-0.5">
                {client.redirectUris.map((uri) => (
                  <li key={uri} className="font-mono text-xs break-all">
                    {uri}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>アプリを削除します</DialogTitle>
            <DialogDescription>
              {deleting?.clientName ?? deleting?.clientId} を削除します。このアプリを
              使っている人は次のログインから入れなくなり、発行済みのトークンも
              無効になります。元に戻せません。
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleting(null)}
            >
              やめる
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const target = deleting;
                if (!target) return;
                startTransition(async () => {
                  const result = await deleteApp(target.clientId);
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                  setDeleting(null);
                });
              }}
            >
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
